import React, { useState } from "react";
import { Car } from "lucide-react";

/**
 * Imagem do veículo com fallback elegante.
 * Se a foto faltar ou falhar ao carregar (ex.: offline), mostra um
 * placeholder escuro com ícone de carro — o card nunca quebra.
 */
export default function CarImage({ src, alt, className = "" }) {
  const [erro, setErro] = useState(false);
  const mostrarFoto = src && !erro;

  return (
    <div className={`relative overflow-hidden bg-surface2 ${className}`}>
      {mostrarFoto ? (
        <img
          src={src}
          alt={alt}
          loading="lazy"
          onError={() => setErro(true)}
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-surface2 to-ink">
          <Car className="text-line" size={56} strokeWidth={1.2} />
        </div>
      )}
      {/* Degradê pra leitura do texto sobreposto */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
    </div>
  );
}
