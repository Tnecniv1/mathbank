declare module "markdown-it-katex" {
  import type MarkdownIt from "markdown-it";
  const mdKatex: (md: MarkdownIt) => void;
  export default mdKatex;
}
