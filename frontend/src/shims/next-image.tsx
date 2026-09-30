import type { CSSProperties, ImgHTMLAttributes } from "react";

type ImageProps = ImgHTMLAttributes<HTMLImageElement> & {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  fill?: boolean;
  unoptimized?: boolean;
  priority?: boolean;
};

/** Minimal stand-in for `next/image` in the Vite SPA. */
export default function Image({
  src,
  alt,
  width,
  height,
  fill,
  className,
  style,
  ...props
}: ImageProps) {
  if (fill) {
    const fillStyle: CSSProperties = {
      height: "100%",
      inset: 0,
      objectFit: "cover",
      position: "absolute",
      width: "100%",
      ...style,
    };
    return (
      <img
        alt={alt}
        className={className}
        decoding="async"
        src={src}
        style={fillStyle}
        {...props}
      />
    );
  }

  return (
    <img
      alt={alt}
      className={className}
      decoding="async"
      height={height}
      src={src}
      style={style}
      width={width}
      {...props}
    />
  );
}
