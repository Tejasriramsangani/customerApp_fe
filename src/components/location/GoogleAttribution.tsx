import Image from "next/image";

export function GoogleAttribution() {
  return (
    <div className="p-3 flex justify-end">
      <Image
        src="/google-attribution.png"
        alt="Google Maps"
        width={98}
        height={18}
        unoptimized
      />
    </div>
  );
}
