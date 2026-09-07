export const EDITOR_COMPATIBILITY_FIXTURE = `
<h1>Fixture H1</h1>
<h2>Fixture H2</h2>
<h3>Fixture H3</h3>
<h4>Fixture H4</h4>
<h5>Fixture H5</h5>
<h6>Fixture H6</h6>
<p>hello <strong>bold</strong> <em>italic</em> <u>underline</u> <del>strike</del> <code>inline()</code></p>
<p><br /></p>
<p style="text-align: center; line-height: 1.5">
  <span style="font-size: 20px; font-family: 'PingFang SC', 'Microsoft YaHei', sans-serif; color: #ef4444; background-color: #fef08a">styled text</span>
  <mark style="background-color: #dbeafe">marked text</mark>
</p>
<ul><li><p>bullet item</p></li></ul>
<ol><li><p>ordered item</p></li></ol>
<ul data-type="taskList"><li data-type="taskItem" data-checked="true"><p>completed task</p></li></ul>
<blockquote><p>quoted text</p></blockquote>
<hr />
<pre><code>const safe = true;</code></pre>
<p><a href="/docs/internal">internal link</a> <a href="https://example.com/docs">external link</a></p>
<img src="/uploads/images/fixture.png" alt="fixture image" title="fixture title" width="320" height="180" align="right" />
<video controls poster="/uploads/images/poster.jpg" preload="metadata" width="640" height="360"><source src="/uploads/videos/fixture.mp4" type="video/mp4" /></video>
<p><a href="/uploads/files/fixture.pdf" target="_blank" rel="noopener noreferrer">📎 fixture.pdf</a></p>
<iframe src="https://video.example.com/embed/fixture" title="fixture embed" width="640" height="360" allow="fullscreen" allowfullscreen></iframe>
<div class="callout callout-note"><strong>[提示 NOTE]</strong> note content</div>
<div class="callout callout-tip"><strong>[技巧 TIP]</strong> tip content</div>
<div class="callout callout-warning"><strong>[警告 WARNING]</strong> warning content</div>
<table class="fixture-table" style="width: 80%">
  <thead><tr><th>Header A</th><th>Header B</th></tr></thead>
  <tbody><tr><td colspan="2">simple table cell</td></tr></tbody>
</table>
<table class="ace-table" style="width: 500px" data-ace-table-col-widths="300;200">
  <tbody>
    <tr><td rowspan="2">rowspan cell</td><td>no header cell</td></tr>
    <tr><td>second row</td></tr>
  </tbody>
</table>
`;
