/** Digit runs in font-mono, Thai words and units stay in the sans font (Geist Mono has no Thai glyphs). */
export function Mono({ text }: { text: string }) {
  return (
    <>
      {text.split(/(\d[\d,.]*\d|\d)/).map((part, i) =>
        i % 2 === 1 ? (
          <span key={i} className="font-mono">
            {part}
          </span>
        ) : (
          part
        ),
      )}
    </>
  );
}
