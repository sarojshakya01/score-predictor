"use client";

import React, { useState, useEffect } from "react";
import Image, { ImageProps } from "next/image";


const fallbackSrc = "/images/logo-tournament.avif";

const ImageWithFallback = ({
  src,
  alt,
  ...rest
}: ImageProps) => {
  const [imgSrc, setImgSrc] = useState(src);

  // Sync state if the parent component updates the primary src prop
  useEffect(() => {
    setImgSrc(src); // eslint-disable-line react-hooks/set-state-in-effect
  }, [src]);

  let origSrc = imgSrc;
  if (typeof imgSrc === 'string' && imgSrc.includes("undefined.png")) {
    origSrc = fallbackSrc;
  }

  return (
    <Image
      {...rest}
      src={origSrc}
      alt={alt}
      className="object-cover object-center w-auto h-[504px] rounded-md"
      loading="eager"
      onError={() => {
        setImgSrc(fallbackSrc);
      }}
    />
  );
}

export default ImageWithFallback;