import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { LayoutChangeEvent } from 'react-native';
import { Pressable, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import ReanimatedSwipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import type { SwipeableMethods } from 'react-native-gesture-handler/ReanimatedSwipeable';
import Animated, {
  runOnJS, useAnimatedStyle, useSharedValue, withSpring,
} from 'react-native-reanimated';
import type { SharedValue } from 'react-native-reanimated';
import { ArrowDownIcon } from 'phosphor-react-native/src/icons/ArrowDown';
import { BedIcon } from 'phosphor-react-native/src/icons/Bed';
import { CheckCircleIcon } from 'phosphor-react-native/src/icons/CheckCircle';
import { DotsSixVerticalIcon } from 'phosphor-react-native/src/icons/DotsSixVertical';
import { InfoIcon } from 'phosphor-react-native/src/icons/Info';
import { MapPinIcon } from 'phosphor-react-native/src/icons/MapPin';
import { PlusIcon } from 'phosphor-react-native/src/icons/Plus';
import { TrashIcon } from 'phosphor-react-native/src/icons/Trash';
import { iconFor } from '@/src/design/icons';
import { Animation, Gutter, PRESSED_OPACITY, Radius, Shadow, TypeColors, Typography } from '@/src/design/tokens';
import { createThemedStyles } from '@/src/design/useTheme';
import type {
  TimelineBand, TimelineBandKey, TimelineDay, TimelineEntry,
} from '@/src/domain/itineraryTimeline';
import { Photo, tap } from '@/src/ui';
import { hexWithAlpha } from '@/src/utils/colors';

interface TimelineDayProps {
  day: TimelineDay;
  stopColors: Record<string, string>;
  onEntryPress?: (entry: TimelineEntry) => void;
  onEntryNavigate?: (entry: TimelineEntry) => void;
  onEntryRemove?: (entry: TimelineEntry) => void;
  dragPlacements?: Record<string, TimelineDragPlacement>;
  dragEnabled?: boolean;
  onEntryDrop?: (request: TimelineDropRequest) => void;
  onAdd?: (dateIso: string, band: TimelineBandKey) => void;
  onLayout?: (dateIso: string, event: LayoutChangeEvent) => void;
  /** Offset within this day where its from-stop hands ownership to its to-stop. */
  onStopBoundaryLayout?: (dateIso: string, offsetY: number) => void;
  contentScrollY?: SharedValue<number>;
  contentOriginY?: SharedValue<number>;
  stickyTop?: SharedValue<number>;
}

export interface TimelineDragPlacement {
  stopId: string;
  dayId: string;
  itemId: string;
}

export interface TimelineDropRequest {
  entry: TimelineEntry;
  placement: TimelineDragPlacement;
  targetItemId?: string;
  afterTarget: boolean;
  /** Undefined retains time, null makes the item unscheduled, and a string changes it. */
  time?: string | null;
  destinationLabel: string;
}

interface MeasuredRow {
  entry: TimelineEntry;
  placement: TimelineDragPlacement;
  y: number;
  height: number;
}

interface MeasuredZone {
  key: TimelineBandKey | 'unscheduled';
  label: string;
  y: number;
  height: number;
}

interface ActiveDrag {
  entryId: string;
  scopeKey: string;
  placeholderTop: number;
  placeholderHeight: number;
  request: TimelineDropRequest;
}

export const TIMELINE_DAY_BAR_HEIGHT = 34;

/** One date in the continuous trip timeline, including its push-away sticky day bar. */
export const TimelineDayView = memo(function TimelineDayView({
  day, stopColors, onEntryPress, onEntryNavigate, onEntryRemove, onAdd, onLayout, onStopBoundaryLayout,
  dragPlacements = {}, dragEnabled = true, onEntryDrop,
  contentScrollY, contentOriginY, stickyTop,
}: TimelineDayProps) {
  const [s, t] = useStyles();
  const cities = day.segments.map(segment => segment.city).join(' → ') || 'Travel';
  const dayY = useSharedValue(0);
  const dayHeight = useSharedValue(0);
  const bodyRef = useRef<View>(null);
  const bodyWindowYRef = useRef(0);
  const rowRefs = useRef<Record<string, View | null>>({});
  const rowMeta = useRef<Record<string, Pick<MeasuredRow, 'entry' | 'placement'>>>({});
  const measuredRows = useRef<Record<string, MeasuredRow>>({});
  const zoneRefs = useRef<Record<string, View | null>>({});
  const zoneMeta = useRef<Record<string, Pick<MeasuredZone, 'key' | 'label'>>>({});
  const measuredZones = useRef<Record<string, MeasuredZone>>({});
  const activeDragRef = useRef<ActiveDrag | null>(null);
  const [activeDrag, setActiveDrag] = useState<ActiveDrag | null>(null);
  const stickyDayBar = useAnimatedStyle(() => {
    if (!contentScrollY || !stickyTop) return {};
    const maximum = Math.max(0, dayHeight.value - TIMELINE_DAY_BAR_HEIGHT);
    const requested =
      stickyTop.value +
      contentScrollY.value -
      (contentOriginY?.value ?? 0) -
      dayY.value;
    return {
      transform: [{ translateY: Math.max(0, Math.min(requested, maximum)) }],
    };
  });

  const handleLayout = (event: LayoutChangeEvent) => {
    const { y, height } = event.nativeEvent.layout;
    dayY.value = y;
    dayHeight.value = height;
    onLayout?.(day.dateIso, event);
  };

  const measureBody = useCallback(() => {
    bodyRef.current?.measureInWindow((_x, y) => { bodyWindowYRef.current = y; });
  }, []);

  const measureRow = useCallback((entryId: string) => {
    const node = rowRefs.current[entryId];
    const meta = rowMeta.current[entryId];
    node?.measureInWindow((_x, y, _width, height) => {
      if (meta) measuredRows.current[entryId] = { ...meta, y, height };
    });
  }, []);

  const measureZone = useCallback((zoneKey: string) => {
    const node = zoneRefs.current[zoneKey];
    const meta = zoneMeta.current[zoneKey];
    node?.measureInWindow((_x, y, _width, height) => {
      if (meta) measuredZones.current[zoneKey] = { ...meta, y, height };
    });
  }, []);

  const registerRow = useCallback((
    entry: TimelineEntry,
    placement: TimelineDragPlacement,
    node: View | null,
  ) => {
    if (!node) return;
    rowRefs.current[entry.id] = node;
    rowMeta.current[entry.id] = { entry, placement };
  }, []);

  const registerZone = useCallback((
    key: TimelineBandKey | 'unscheduled',
    label: string,
    node: View | null,
  ) => {
    if (!node) return;
    zoneRefs.current[key] = node;
    zoneMeta.current[key] = { key, label };
  }, []);

  useEffect(() => {
    const liveEntryIds = new Set(
      [...day.bands.flatMap(band => band.entries), ...day.unscheduled]
        .filter(entry => dragPlacements[entry.id])
        .map(entry => entry.id),
    );
    for (const entryId of Object.keys(rowRefs.current)) {
      if (liveEntryIds.has(entryId)) continue;
      delete rowRefs.current[entryId];
      delete rowMeta.current[entryId];
      delete measuredRows.current[entryId];
    }
    if (day.unscheduled.length === 0 && !activeDragRef.current) {
      delete zoneRefs.current.unscheduled;
      delete zoneMeta.current.unscheduled;
      delete measuredZones.current.unscheduled;
    }
  }, [day.bands, day.unscheduled, dragPlacements]);

  const refreshMeasurements = useCallback(() => {
    measureBody();
    Object.keys(rowRefs.current).forEach(measureRow);
    Object.keys(zoneRefs.current).forEach(measureZone);
  }, [measureBody, measureRow, measureZone]);

  const beginDrag = useCallback((entry: TimelineEntry, placement: TimelineDragPlacement) => {
    refreshMeasurements();
    tap();
    const source = measuredRows.current[entry.id];
    const request: TimelineDropRequest = {
      entry,
      placement,
      targetItemId: placement.itemId,
      afterTarget: false,
      destinationLabel: entry.time.label,
    };
    const next: ActiveDrag = {
      entryId: entry.id,
      scopeKey: `${placement.stopId}:${placement.dayId}`,
      placeholderTop: (source?.y ?? bodyWindowYRef.current) - bodyWindowYRef.current,
      placeholderHeight: source?.height ?? 50,
      request,
    };
    activeDragRef.current = next;
    setActiveDrag(next);
  }, [refreshMeasurements]);

  const updateDrag = useCallback((absoluteY: number) => {
    const current = activeDragRef.current;
    if (!current) return;
    const zones = Object.values(measuredZones.current);
    if (zones.length === 0) return;
    const zone = zones.reduce((best, candidate) => {
      const distance = absoluteY < candidate.y
        ? candidate.y - absoluteY
        : absoluteY > candidate.y + candidate.height
          ? absoluteY - candidate.y - candidate.height
          : 0;
      const bestDistance = absoluteY < best.y
        ? best.y - absoluteY
        : absoluteY > best.y + best.height
          ? absoluteY - best.y - best.height
          : 0;
      return distance < bestDistance ? candidate : best;
    });
    const rows = Object.values(measuredRows.current).filter(candidate =>
      `${candidate.placement.stopId}:${candidate.placement.dayId}` === current.scopeKey
      && (candidate.entry.time.band ?? 'unscheduled') === zone.key,
    );
    const target = rows.length > 0
      ? rows.reduce((best, candidate) => (
          Math.abs(absoluteY - (candidate.y + candidate.height / 2))
            < Math.abs(absoluteY - (best.y + best.height / 2))
            ? candidate
            : best
        ))
      : undefined;
    const afterTarget = Boolean(
      target
      && target.entry.id !== current.entryId
      && absoluteY >= target.y + target.height / 2,
    );
    const destinationValue = zone.key === 'unscheduled'
      ? null
      : target
        ? target.entry.time.raw ?? target.entry.time.label
        : zone.key;
    const sourceRaw = current.request.entry.time.raw;
    const time = destinationValue === null
      ? current.request.entry.time.precision === 'unscheduled' ? undefined : null
      : current.request.entry.time.band === zone.key && destinationValue === sourceRaw
        ? undefined
        : destinationValue;
    const request: TimelineDropRequest = {
      entry: current.request.entry,
      placement: current.request.placement,
      targetItemId: target?.placement.itemId,
      afterTarget,
      time,
      destinationLabel: target?.entry.time.label ?? zone.label,
    };
    const placeholderY = target
      ? target.y + (afterTarget ? target.height : 0)
      : zone.y + Math.min(34, zone.height);
    const next: ActiveDrag = {
      ...current,
      placeholderTop: placeholderY - bodyWindowYRef.current,
      placeholderHeight: current.placeholderHeight,
      request,
    };
    activeDragRef.current = next;
    const changed = current.request.targetItemId !== request.targetItemId
      || current.request.afterTarget !== request.afterTarget
      || current.request.time !== request.time;
    if (changed) setActiveDrag(next);
  }, []);

  const finishDrag = useCallback((completed: boolean) => {
    const current = activeDragRef.current;
    activeDragRef.current = null;
    setActiveDrag(null);
    if (completed && current) onEntryDrop?.(current.request);
  }, [onEntryDrop]);

  return (
    <View testID={`timeline-day-${day.dateIso}`} onLayout={handleLayout} style={[s.day, day.isPast && s.dayPast]}>
      <Animated.View style={[s.dayBar, stickyDayBar]} accessibilityRole="header">
        <Text style={s.dayDate}>{day.weekday} {day.dayOfMonth}</Text>
        <View style={s.dayStopMarks}>
          {day.segments.length === 0 ? <View style={[s.dayStopMark, { backgroundColor: t.textFaint }]} /> : null}
          {day.segments.map(segment => (
            <View
              key={segment.stopId}
              style={[s.dayStopMark, { backgroundColor: stopColors[segment.stopId] ?? t.textFaint }]}
            />
          ))}
        </View>
        <Text style={s.dayCity} numberOfLines={1}>{cities}</Text>
        {day.isToday ? <View style={s.today}><Text style={s.todayText}>TODAY</Text></View> : null}
        <Text style={s.count}>{day.count} {day.count === 1 ? 'plan' : 'plans'}</Text>
      </Animated.View>

      <View ref={bodyRef} collapsable={false} onLayout={measureBody} style={s.body}>
        {activeDrag ? (
          <View
            pointerEvents="none"
            testID={`timeline-drop-placeholder-${activeDrag.entryId}`}
            style={[
              s.dropPlaceholder,
              { top: activeDrag.placeholderTop, height: activeDrag.placeholderHeight },
            ]}
          />
        ) : null}
        {day.stay ? (
          <View
            testID={`timeline-stay-${day.dateIso}`}
            style={[s.context, !day.stay.confirmed && s.contextWarning]}
            accessibilityLabel={`Tonight. ${day.stay.name}. ${day.stay.detail}`}
          >
            <View style={[s.contextTile, { backgroundColor: hexWithAlpha(TypeColors.stay, 0.1) }]}>
              <BedIcon size={14} color={TypeColors.stay} weight="fill" />
            </View>
            <Text style={s.contextText} numberOfLines={2}>
              <Text style={s.contextLabel}>TONIGHT</Text> · {day.stay.name}
              <Text style={[s.contextDetail, !day.stay.confirmed && { color: t.warning }]}> · {day.stay.detail}</Text>
            </Text>
          </View>
        ) : null}

        {day.transition ? (
          <View
            testID={`timeline-transition-${day.dateIso}`}
            style={s.transition}
            onLayout={event => onStopBoundaryLayout?.(
              day.dateIso,
              TIMELINE_DAY_BAR_HEIGHT + event.nativeEvent.layout.y,
            )}
          >
            <View style={s.transitionNode}><ArrowDownIcon size={10} color={t.textMuted} weight="bold" /></View>
            <View style={s.transitionCard}>
              <Text style={s.transitionTitle}>
                {day.transition.fromCity} → {day.transition.toCity}
              </Text>
              <Text style={s.transitionSub}>Moving between stops</Text>
            </View>
          </View>
        ) : null}

        {day.bands.map(band => (
          <TimeBand
            key={band.key}
            band={band}
            dateIso={day.dateIso}
            onEntryPress={onEntryPress}
            onEntryNavigate={onEntryNavigate}
            onEntryRemove={onEntryRemove}
            onAdd={onAdd}
            dragPlacements={dragPlacements}
            dragEnabled={dragEnabled}
            activeDrag={activeDrag}
            onRegisterRow={registerRow}
            onMeasureRow={measureRow}
            onRegisterZone={registerZone}
            onMeasureZone={measureZone}
            onDragStart={beginDrag}
            onDragUpdate={updateDrag}
            onDragFinish={finishDrag}
          />
        ))}

        {day.unscheduled.length || activeDrag ? (
          <View
            ref={node => registerZone('unscheduled', 'Unscheduled', node)}
            collapsable={false}
            testID={`timeline-unscheduled-${day.dateIso}`}
            onLayout={() => measureZone('unscheduled')}
          >
            <View style={s.bandHeader}>
              <Text style={s.bandSpan}>—</Text>
              <View style={s.spineCol}><View style={s.spineLine} /><View style={s.bandTick} /></View>
              <Text style={s.bandLabel}>UNSCHEDULED</Text>
            </View>
            {day.unscheduled.map(entry => (
              <TimelineEntryRow
                key={entry.id}
                entry={entry}
                onPress={onEntryPress}
                onNavigate={onEntryNavigate}
                onRemove={onEntryRemove}
                dragPlacement={dragPlacements[entry.id]}
                dragEnabled={dragEnabled}
                dragActive={activeDrag?.entryId === entry.id}
                dragDimmed={Boolean(activeDrag && activeDrag.entryId !== entry.id)}
                onRegisterDragRow={registerRow}
                onMeasureDragRow={measureRow}
                onDragStart={beginDrag}
                onDragUpdate={updateDrag}
                onDragFinish={finishDrag}
              />
            ))}
          </View>
        ) : null}
      </View>
    </View>
  );
});

function TimeBand({
  band, dateIso, onEntryPress, onEntryNavigate, onEntryRemove, onAdd,
  dragPlacements, dragEnabled, activeDrag,
  onRegisterRow, onMeasureRow, onRegisterZone, onMeasureZone,
  onDragStart, onDragUpdate, onDragFinish,
}: {
  band: TimelineBand;
  dateIso: string;
  onEntryPress?: (entry: TimelineEntry) => void;
  onEntryNavigate?: (entry: TimelineEntry) => void;
  onEntryRemove?: (entry: TimelineEntry) => void;
  onAdd?: (dateIso: string, band: TimelineBandKey) => void;
  dragPlacements: Record<string, TimelineDragPlacement>;
  dragEnabled: boolean;
  activeDrag: ActiveDrag | null;
  onRegisterRow: (entry: TimelineEntry, placement: TimelineDragPlacement, node: View | null) => void;
  onMeasureRow: (entryId: string) => void;
  onRegisterZone: (key: TimelineBandKey, label: string, node: View | null) => void;
  onMeasureZone: (key: TimelineBandKey) => void;
  onDragStart: (entry: TimelineEntry, placement: TimelineDragPlacement) => void;
  onDragUpdate: (absoluteY: number) => void;
  onDragFinish: (completed: boolean) => void;
}) {
  const [s, t] = useStyles();
  return (
    <View
      ref={node => onRegisterZone(band.key, band.label, node)}
      collapsable={false}
      testID={`timeline-band-${dateIso}-${band.key}`}
      onLayout={() => onMeasureZone(band.key)}
    >
      <View style={s.bandHeader}>
        <Text style={s.bandSpan}>{band.span}</Text>
        <View style={s.spineCol}><View style={s.spineLine} /><View style={s.bandTick} /></View>
        <Text style={s.bandLabel}>{band.label}</Text>
      </View>
      {band.entries.map(entry => (
        <TimelineEntryRow
          key={entry.id}
          entry={entry}
          onPress={onEntryPress}
          onNavigate={onEntryNavigate}
          onRemove={onEntryRemove}
          dragPlacement={dragPlacements[entry.id]}
          dragEnabled={dragEnabled}
          dragActive={activeDrag?.entryId === entry.id}
          dragDimmed={Boolean(activeDrag && activeDrag.entryId !== entry.id)}
          onRegisterDragRow={onRegisterRow}
          onMeasureDragRow={onMeasureRow}
          onDragStart={onDragStart}
          onDragUpdate={onDragUpdate}
          onDragFinish={onDragFinish}
        />
      ))}
      {band.showEmptyPrompt && band.entries.length === 0 && onAdd ? (
        <View style={s.emptyLine}>
          <View style={s.emptyTime} />
          <View style={s.spineCol}><View style={s.spineLine} /><View style={s.emptyNode} /></View>
          <Pressable
            testID={`timeline-add-${dateIso}-${band.key}`}
            accessibilityRole="button"
            accessibilityLabel={`Nothing planned ${band.label.toLowerCase()}. Add a plan.`}
            hitSlop={7}
            onPress={() => { tap(); onAdd(dateIso, band.key); }}
            style={({ pressed }) => [s.emptyAction, pressed && s.pressed]}
          >
            <PlusIcon size={12} color={t.textMuted} weight="regular" />
            <Text style={s.emptyText}>Nothing planned</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

export function TimelineEntryRow({
  entry, onPress, onNavigate, onRemove,
  dragPlacement, dragEnabled = true, dragActive = false, dragDimmed = false,
  onRegisterDragRow, onMeasureDragRow, onDragStart, onDragUpdate, onDragFinish,
}: {
  entry: TimelineEntry;
  onPress?: (entry: TimelineEntry) => void;
  onNavigate?: (entry: TimelineEntry) => void;
  onRemove?: (entry: TimelineEntry) => void;
  dragPlacement?: TimelineDragPlacement;
  dragEnabled?: boolean;
  dragActive?: boolean;
  dragDimmed?: boolean;
  onRegisterDragRow?: (entry: TimelineEntry, placement: TimelineDragPlacement, node: View | null) => void;
  onMeasureDragRow?: (entryId: string) => void;
  onDragStart?: (entry: TimelineEntry, placement: TimelineDragPlacement) => void;
  onDragUpdate?: (absoluteY: number) => void;
  onDragFinish?: (completed: boolean) => void;
}) {
  const [s, t] = useStyles();
  const Glyph = iconFor(entry.category, entry.subtype);
  const typeColor = entry.category ? TypeColors[entry.category] : t.textFaint;
  const press = onPress ? () => onPress(entry) : undefined;
  const draggable = Boolean(
    dragEnabled && dragPlacement && onDragStart && onDragUpdate && onDragFinish,
  );
  const dragY = useSharedValue(0);
  const dragStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: dragY.value },
      { scale: dragActive ? 1.025 : 1 },
      { rotate: dragActive ? '-0.4deg' : '0deg' },
    ],
  }), [dragActive]);
  const dragGesture = useMemo(() => Gesture.Pan()
    .enabled(draggable)
    .maxPointers(1)
    .activateAfterLongPress(280)
    .onStart(() => {
      if (dragPlacement && onDragStart) runOnJS(onDragStart)(entry, dragPlacement);
    })
    .onUpdate(event => {
      dragY.value = event.translationY;
      if (onDragUpdate) runOnJS(onDragUpdate)(event.absoluteY);
    })
    .onFinalize((_event, completed) => {
      dragY.value = withSpring(0, Animation.springs.gentle);
      if (onDragFinish) runOnJS(onDragFinish)(completed);
    }), [dragPlacement, draggable, dragY, entry, onDragFinish, onDragStart, onDragUpdate]);

  const row = (
    <Pressable
      testID={`timeline-entry-${entry.id}`}
      accessibilityRole={press ? 'button' : undefined}
      accessibilityLabel={[entry.time.label, entry.title, entry.meta].filter(Boolean).join('. ')}
      disabled={!press}
      onPress={press}
      style={({ pressed }) => [s.entry, entry.past && s.entryPast, pressed && press && s.pressed]}
    >
      <Text
        style={[s.entryTime, entry.time.precision !== 'hard' && s.entryTimeLoose]}
        numberOfLines={1}
      >
        {entry.time.label}
      </Text>
      <View style={s.spineCol}>
        <View style={s.spineLine} />
        <View style={[
          s.entryNode,
          entry.time.precision === 'hard'
            ? { backgroundColor: typeColor, borderColor: typeColor }
            : { backgroundColor: t.surface, borderColor: t.textFaint, borderStyle: 'dashed' },
        ]} />
      </View>
      <View style={s.entryContent}>
        <Photo
          source={entry.photo}
          Glyph={Glyph}
          glyphSize={17}
          style={[s.entryTile, !entry.photo && { backgroundColor: hexWithAlpha(typeColor, 0.1) }]}
          accessibilityLabel={entry.photo ? `${entry.title} photo` : undefined}
        />
        <View style={s.entryBody}>
          <Text style={s.entryTitle} numberOfLines={1}>{entry.title}</Text>
          {entry.meta ? <Text style={s.entryMeta} numberOfLines={1}>{entry.meta}</Text> : null}
        </View>
        {entry.secured ? (
          <CheckCircleIcon
            size={16}
            color={entry.confirmed ? t.action : t.warning}
            weight="fill"
          />
        ) : null}
        {dragPlacement ? (
          <View
            testID={`timeline-entry-drag-handle-${entry.id}`}
            accessibilityElementsHidden
            importantForAccessibility="no"
            style={s.dragHandle}
          >
            <DotsSixVerticalIcon size={18} color={t.textFaint} weight="bold" />
          </View>
        ) : null}
      </View>
    </Pressable>
  );

  const renderRightActions = (
    _progress: unknown,
    _translation: unknown,
    swipeable: SwipeableMethods,
  ) => (
    <View style={s.swipeActions}>
      <SwipeAction
        label="Details"
        Glyph={InfoIcon}
        testID={`timeline-entry-details-${entry.id}`}
        onPress={() => { swipeable.close(); onPress?.(entry); }}
      />
      {entry.address && onNavigate ? (
        <SwipeAction
          label="Navigate"
          Glyph={MapPinIcon}
          accent
          testID={`timeline-entry-navigate-${entry.id}`}
          onPress={() => { swipeable.close(); onNavigate(entry); }}
        />
      ) : null}
    </View>
  );

  const renderLeftActions = (
    _progress: unknown,
    _translation: unknown,
    swipeable: SwipeableMethods,
  ) => (
    <View style={s.swipeActions}>
      <SwipeAction
        label="Remove"
        Glyph={TrashIcon}
        destructive
        testID={`timeline-entry-remove-${entry.id}`}
        onPress={() => { swipeable.close(); onRemove?.(entry); }}
      />
    </View>
  );

  const swipeable = !onPress && !onRemove ? row : (
    <ReanimatedSwipeable
      testID={`timeline-entry-swipe-${entry.id}`}
      enabled={!dragActive}
      friction={1.6}
      leftThreshold={48}
      rightThreshold={42}
      overshootLeft={false}
      overshootRight={false}
      renderLeftActions={onRemove ? renderLeftActions : undefined}
      renderRightActions={onPress ? renderRightActions : undefined}
      childrenContainerStyle={s.swipeForeground}
    >
      {row}
    </ReanimatedSwipeable>
  );

  if (!dragPlacement) return swipeable;

  return (
    <GestureDetector gesture={dragGesture}>
      <Animated.View
        ref={(node: View | null) => onRegisterDragRow?.(entry, dragPlacement, node)}
        collapsable={false}
        onLayout={() => onMeasureDragRow?.(entry.id)}
        style={[
          s.dragRow,
          dragDimmed && s.dragRowDimmed,
          dragActive && s.dragRowActive,
          dragStyle,
        ]}
      >
        {swipeable}
      </Animated.View>
    </GestureDetector>
  );
}

function SwipeAction({
  label, Glyph, accent, destructive, onPress, testID,
}: {
  label: string;
  Glyph: typeof InfoIcon;
  accent?: boolean;
  destructive?: boolean;
  onPress: () => void;
  testID: string;
}) {
  const [s, t] = useStyles();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={() => { tap(); onPress(); }}
      style={({ pressed }) => [
        s.swipeAction,
        accent && s.swipeActionAccent,
        destructive && s.swipeActionDestructive,
        pressed && s.pressed,
      ]}
    >
      <Glyph size={destructive ? 18 : 17} color={accent || destructive ? t.textInverse : t.textMuted} weight="fill" />
      <Text style={[
        s.swipeActionLabel,
        (accent || destructive) && s.swipeActionLabelAccent,
      ]}>{label}</Text>
    </Pressable>
  );
}

const TIME_WIDTH = 62;
const SPINE_WIDTH = 24;

const useStyles = createThemedStyles((t) => ({
  day: { backgroundColor: t.surface },
  dayPast: { opacity: 0.72 },
  dayBar: {
    height: TIMELINE_DAY_BAR_HEIGHT,
    position: 'relative',
    zIndex: 10,
    backgroundColor: t.surface,
    borderBottomWidth: 1,
    borderBottomColor: t.border,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: Gutter,
  },
  dayDate: { ...Typography.roles.data, color: t.text },
  dayStopMarks: { flexDirection: 'row', gap: 2 },
  dayStopMark: { width: 5, height: 5, borderRadius: 3 },
  dayCity: { ...Typography.roles.sub, color: t.textMuted, flex: 1 },
  today: { height: 16, paddingHorizontal: 6, borderRadius: Radius.full, backgroundColor: t.action, justifyContent: 'center' },
  todayText: { fontFamily: 'DMSans-Bold', fontWeight: '700' as const, fontSize: 8, lineHeight: 8, letterSpacing: 0.8, color: t.surface },
  count: { ...Typography.roles.dataSm, color: t.textFaint },
  body: { paddingHorizontal: Gutter, paddingBottom: 4 },

  context: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    paddingHorizontal: 11,
    marginTop: 12,
    borderRadius: 13,
    backgroundColor: t.surfaceSunken,
    borderWidth: 1,
    borderColor: t.border,
  },
  contextWarning: { borderColor: t.warningLine, backgroundColor: t.warningSoft },
  contextTile: { width: 26, height: 26, borderRadius: Radius.icon, alignItems: 'center', justifyContent: 'center' },
  contextText: { ...Typography.roles.sub, fontFamily: 'DMSans-SemiBold', fontWeight: '600' as const, color: t.text, flex: 1 },
  contextLabel: { fontFamily: 'DMSans-Bold', fontWeight: '700' as const, fontSize: 8, letterSpacing: 1.1, color: t.textFaint },
  contextDetail: { fontFamily: 'DMSans', fontWeight: '400' as const, color: t.textMuted },

  transition: { flexDirection: 'row', alignItems: 'center', paddingTop: 10, paddingLeft: TIME_WIDTH + 2 },
  transitionNode: {
    width: 19, height: 19, borderRadius: 10, borderWidth: 1.5, borderColor: t.border,
    backgroundColor: t.surface, alignItems: 'center', justifyContent: 'center', zIndex: 1,
  },
  transitionCard: { flex: 1, marginLeft: 10, padding: 10, borderRadius: 13, borderWidth: 1, borderColor: t.border, backgroundColor: t.surfaceSunken },
  transitionTitle: { ...Typography.roles.caps, color: t.textMuted },
  transitionSub: { ...Typography.roles.sub, color: t.textFaint, marginTop: 4 },

  bandHeader: { minHeight: 34, flexDirection: 'row' },
  bandSpan: { width: TIME_WIDTH, paddingTop: 11, paddingRight: 9, textAlign: 'right', ...Typography.roles.dataSm, fontSize: 9, color: t.textDisabled },
  bandLabel: { flex: 1, paddingTop: 10, paddingLeft: 8, ...Typography.roles.caps, fontSize: 8.5, color: t.textFaint },
  spineCol: { width: SPINE_WIDTH, position: 'relative', alignItems: 'center' },
  spineLine: { position: 'absolute', top: 0, bottom: 0, width: 1.5, backgroundColor: t.border },
  bandTick: { marginTop: 13, width: 7, height: 1.5, backgroundColor: t.border },

  entry: { minHeight: 50, flexDirection: 'row' },
  entryPast: { opacity: 0.42 },
  entryTime: { width: TIME_WIDTH, paddingTop: 13, paddingRight: 9, textAlign: 'right', ...Typography.roles.dataSm, color: t.text },
  // The web canvas uses italic for loose time, but no italic native face is bundled. Upright
  // DMSans is the honest fallback until the design system adds one.
  entryTimeLoose: { fontFamily: 'DMSans', fontWeight: '400' as const, color: t.textMuted },
  entryNode: { marginTop: 15, width: 10, height: 10, borderRadius: 5, borderWidth: 1.5, zIndex: 1 },
  entryContent: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 9, paddingVertical: 7, paddingLeft: 8 },
  entryTile: { width: 36, height: 36, borderRadius: 11 },
  entryBody: { flex: 1, minWidth: 0 },
  entryTitle: { ...Typography.roles.row, fontSize: 13, lineHeight: 16, color: t.text },
  entryMeta: { ...Typography.roles.sub, color: t.textMuted, marginTop: 1 },
  dragHandle: {
    width: 28,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dragRow: { position: 'relative', zIndex: 1 },
  dragRowDimmed: { opacity: 0.48 },
  dragRowActive: {
    zIndex: 50,
    borderRadius: Radius.row,
    backgroundColor: t.surface,
    ...Shadow.float,
  },
  dropPlaceholder: {
    position: 'absolute',
    left: TIME_WIDTH + SPINE_WIDTH + 8,
    right: 0,
    zIndex: 40,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: t.action,
    borderRadius: Radius.row,
    backgroundColor: t.actionSoft,
  },
  swipeForeground: { backgroundColor: t.surface },
  swipeActions: { flexDirection: 'row', alignSelf: 'stretch' },
  swipeAction: { width: 74, alignItems: 'center', justifyContent: 'center', gap: 4, backgroundColor: t.surfaceMuted },
  swipeActionAccent: { backgroundColor: t.action },
  swipeActionDestructive: { width: 92, backgroundColor: t.error },
  swipeActionLabel: { ...Typography.roles.caps, fontSize: 8, color: t.textMuted },
  swipeActionLabelAccent: { color: t.textInverse },

  emptyLine: { minHeight: 44, flexDirection: 'row' },
  emptyTime: { width: TIME_WIDTH },
  emptyNode: { marginTop: 16, width: 11, height: 11, borderRadius: 6, borderWidth: 1.5, borderStyle: 'dashed' as const, borderColor: t.textFaint, backgroundColor: t.surface, zIndex: 1 },
  emptyAction: {
    alignSelf: 'center',
    minHeight: 30,
    marginLeft: 8,
    paddingHorizontal: 11,
    borderRadius: 10,
    borderWidth: 1,
    borderStyle: 'dashed' as const,
    borderColor: t.border,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  emptyText: { ...Typography.roles.sub, fontFamily: 'DMSans-SemiBold', fontWeight: '600' as const, color: t.textMuted },
  pressed: { opacity: PRESSED_OPACITY },
}));
