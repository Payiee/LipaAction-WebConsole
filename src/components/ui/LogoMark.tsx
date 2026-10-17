import Image from "next/image";

/**
 * The LipaAction mark (the L and A with the siren), beside the console's
 * name on the sidebar and the sign-in pages. Decorative: the name next to it
 * says what it is. The same picture is the browser tab's icon
 * (src/app/icon.png, favicon.ico, apple-icon.png).
 */
export function LogoMark({ size = 32 }: { size?: number }) {
  return <Image src="/logo-mark.png" alt="" width={size} height={size} priority className="shrink-0" />;
}
