export function toType(args: { name: string; required: boolean }) {
  return `${args.name}${args.required ? '' : '?'}: string`;
}
