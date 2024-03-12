export interface Source {
  idx: number;
  str: string;
}
export function source(str: string) {
  return { str, idx: 0 };
}

export function skipWhitespace(src: Source) {
  while (
    src.idx < src.str.length &&
    "\n\t\b ".includes(src.str.charAt(src.idx))
  ) {
    src.idx++;
  }
}

export function pop(src: Source) {
  let ch = src.str.charAt(src.idx);
  src.idx++;
  return ch;
}

export function peek(src: Source) {
  if (src.idx >= src.str.length) {
    return undefined;
  }
  return src.str.charAt(src.idx);
}
