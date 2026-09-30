/**
 * CSS Modules declaration for the browser half.
 *
 * `tsdown.config.ts` compiles every `*.module.css` through lightningcss into a
 * hashed class map and inlines the stylesheet text; TypeScript never sees the
 * generated names, so the shape is declared here rather than inferred.
 */
declare module '*.module.css' {
  /** Local class name to generated class name. */
  const classes: Readonly<Record<string, string>>
  export default classes
}
