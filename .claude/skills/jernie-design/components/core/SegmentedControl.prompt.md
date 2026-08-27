Use when the same content has two to four lenses. If the options load different data, they are tabs, not segments.

```jsx
<SegmentedControl value="type" onChange={setLens}
  options={[{value:'type',label:'By type'},{value:'day',label:'By day'},{value:'stop',label:'By stop'}]} />
```
