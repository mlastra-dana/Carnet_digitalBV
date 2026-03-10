import React, { useEffect, useRef, useState } from "react";

function Home() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [photoDataUrl, setPhotoDataUrl] = useState("");
  const [cameraOn, setCameraOn] = useState(false);
  const [isPreview, setIsPreview] = useState(false);
  const [passType, setPassType] = useState("eventTicket");

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem("walletPhoto");
    if (stored) {
      setPhotoDataUrl(stored);
    }
  }, []);

  const stopCamera = () => {
    const stream = streamRef.current;
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      // eslint-disable-next-line no-param-reassign
      videoRef.current.srcObject = null;
    }
    setCameraOn(false);
  };

  const startCamera = async () => {
    if (typeof navigator === "undefined" || !navigator.mediaDevices) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      streamRef.current = stream;
      if (videoRef.current) {
        // eslint-disable-next-line no-param-reassign
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraOn(true);
    } catch (error) {
      // No se pudo acceder a la cámara (permisos, dispositivo, etc.)
      // Para esta demo simplemente lo ignoramos.
      console.error("No se pudo iniciar la cámara", error);
    }
  };

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const size = 320;
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, size, size);
    const dataUrl = canvas.toDataURL("image/png");
    setPhotoDataUrl(dataUrl);
    if (typeof window !== "undefined") {
      window.localStorage.setItem("walletPhoto", dataUrl);
    }
  };

  useEffect(
    () => () => {
      stopCamera();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const apiBaseUrl = import.meta.env.VITE_API_URL || "http://localhost:3001";

  const handleSubmit = async (event) => {
    event.preventDefault();
    try {
      await fetch(`${apiBaseUrl.replace(/\/+$/, "")}/dana-contact`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          name,
          email,
          photoDataUrl,
          passType
        })
      });
    } catch (error) {
      console.error("Error al guardar contacto en Dana", error);
    }
    setIsPreview(true);
  };

  if (!isPreview) {
    // Vista principal: solo mensaje y formulario.
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f4f5f7] text-slate-900 px-4">
        <div className="max-w-md w-full text-center space-y-6 bg-white rounded-xl border border-[#d7dde5] shadow-sm px-6 py-8">
          <div className="space-y-2">
            <h1 className="text-2xl font-semibold text-slate-900">
              Carnet del asegurado
            </h1>
            <p className="text-sm text-slate-600">
              Al ingresar observara el carnet del asegurado para la fiesta carnaval
            </p>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4 text-left">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Nombre completo
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full rounded-md border border-[#d7dde5] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#f59f24] focus:border-[#f59f24]"
                placeholder="Ej: Juan Pérez"
              />
            </div>
            <div className="pt-2 border-t border-[#eceff3] mt-4">
              <p className="text-sm font-medium text-slate-700 mb-1">
                Tipo de pase
              </p>
              <p className="text-xs text-slate-500 mb-3">
                Selecciona qué tipo de pase .pkpass deseas generar.
              </p>
              <div className="flex flex-wrap gap-2">
                {[
                  { value: "eventTicket", label: "Evento" },
                  { value: "boardingPass", label: "Embarque" },
                  { value: "storeCard", label: "Tarjeta cliente" },
                  { value: "coupon", label: "Cupón" },
                  { value: "generic", label: "Genérico" },
                  { value: "transit", label: "Transporte" }
                ].map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setPassType(option.value)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium border ${
                      passType === option.value
                        ? "bg-[#f59f24] border-[#f59f24] text-white"
                        : "bg-white border-[#d7dde5] text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Correo electrónico
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full rounded-md border border-[#d7dde5] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#f59f24] focus:border-[#f59f24]"
                placeholder="Ej: persona@correo.com"
              />
            </div>
            <div className="pt-2 border-t border-[#eceff3] mt-4">
              <p className="text-sm font-medium text-slate-700 mb-1">
                Foto del asegurado (opcional)
              </p>
              <p className="text-xs text-slate-500 mb-3">
                Puedes activar la cámara para capturar una foto y previsualizar cómo se verá en el carnet.
              </p>
              <div className="space-y-3">
                <div className="w-full h-40 rounded-md border border-[#d7dde5] bg-slate-100 flex items-center justify-center overflow-hidden">
                  {photoDataUrl ? (
                    <img
                      src={photoDataUrl}
                      alt="Foto capturada"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <video
                      ref={videoRef}
                      className="w-full h-full object-cover"
                      autoPlay
                      playsInline
                      muted
                    />
                  )}
                </div>
                <div className="flex flex-wrap items-center justify-center gap-2">
                  {!cameraOn && (
                    <button
                      type="button"
                      onClick={startCamera}
                      className="px-3 py-2 text-xs rounded-full bg-slate-200 hover:bg-slate-300 text-slate-800 font-medium"
                    >
                      Activar cámara
                    </button>
                  )}
                  {cameraOn && (
                    <button
                      type="button"
                      onClick={capturePhoto}
                      className="px-3 py-2 text-xs rounded-full bg-[#f59f24] hover:bg-[#e88f0e] text-white font-medium"
                    >
                      Capturar foto
                    </button>
                  )}
                  {cameraOn && (
                    <button
                      type="button"
                      onClick={stopCamera}
                      className="px-3 py-2 text-xs rounded-full bg-slate-200 hover:bg-slate-300 text-slate-800 font-medium"
                    >
                      Detener cámara
                    </button>
                  )}
                  {photoDataUrl && (
                    <button
                      type="button"
                      onClick={() => {
                        setPhotoDataUrl("");
                        if (typeof window !== "undefined") {
                          window.localStorage.removeItem("walletPhoto");
                        }
                      }}
                      className="px-3 py-2 text-xs rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium"
                    >
                      Borrar foto
                    </button>
                  )}
                </div>
                <canvas ref={canvasRef} className="hidden" />
              </div>
            </div>
            <div className="pt-2 flex justify-center">
              <button
                type="submit"
                className="px-8 py-3 rounded-full bg-[#f59f24] hover:bg-[#e88f0e] active:bg-[#d27f09] text-white text-lg font-semibold shadow-md transition-transform transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-[#f59f24] focus:ring-offset-2 focus:ring-offset-white"
              >
                acceder a wallet
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  // Vista de previsualización del carnet y botón para descargar el archivo .pkpass real.
  const displayName = name || "Juan Pérez";
  const displayEmail = email || "juan.perez@ejemplo.com";

  const handleDownloadPkpass = async () => {
    try {
      const photo =
        typeof window !== "undefined"
          ? window.localStorage.getItem("walletPhoto")
          : null;

      const response = await fetch(
        `${apiBaseUrl.replace(/\/+$/, "")}/pkpass`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            name: displayName,
            email: displayEmail,
            photoDataUrl: photo,
            passType
          })
        }
      );

      if (!response.ok) {
        throw new Error("No se pudo generar el archivo .pkpass");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "carnet-asegurado.pkpass";
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error(error);
      // Para esta demo solo mostramos el error en consola; aquí podrías mostrar un mensaje en UI.
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f4f5f7] text-slate-900 px-4">
      <div className="max-w-md w-full text-center space-y-6 bg-white rounded-xl border border-[#d7dde5] shadow-sm px-6 py-8">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold text-slate-900">
            Vista previa del carnet
          </h1>
          <p className="text-sm text-slate-600">
            Así se verá el carnet del asegurado para la fiesta carnaval.
          </p>
        </div>

        <div className="mt-4">
          <div className="mx-auto max-w-sm rounded-xl border border-[#ccd4e0] bg-white overflow-hidden shadow-sm">
            <div className="h-20 bg-[#004b8f] flex items-center justify-center">
              <p className="text-xs uppercase tracking-wide text-white font-semibold">
                Carnet del asegurado
              </p>
            </div>
            <div className="px-4 pb-4 flex flex-col items-center text-center gap-3">
              <div className="w-20 h-20 rounded-full overflow-hidden border-2 border-[#004b8f] bg-white -mt-8">
                <img
                  src={
                    photoDataUrl ||
                    (typeof window !== "undefined" &&
                    window.localStorage.getItem("walletPhoto")
                      ? window.localStorage.getItem("walletPhoto")
                      : "https://media.istockphoto.com/id/1389348844/es/foto/foto-de-estudio-de-una-hermosa-joven-sonriendo-mientras-est%C3%A1-de-pie-sobre-un-fondo-gris.jpg?s=612x612&w=0&k=20&c=kUufmNoTnDcRbyeHhU1wRiip-fNjTWP9owjHf75frFQ="
                    )
                  }
                  alt="Foto del asegurado"
                  className="w-full h-full object-cover"
                />
              </div>
              <div>
                <p className="text-lg font-semibold text-slate-900">
                  {displayName}
                </p>
                <p className="text-xs text-slate-500">
                  {displayEmail}
                </p>
              </div>
              <div className="mt-3 w-20 h-20 border border-[#ccd4e0] rounded-sm bg-slate-100 flex items-center justify-center">
                <span className="text-[10px] text-slate-500 tracking-widest">
                  QR
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <button
            type="button"
            onClick={handleDownloadPkpass}
            className="inline-block px-8 py-3 rounded-full bg-[#f59f24] hover:bg-[#e88f0e] active:bg-[#d27f09] text-white text-lg font-semibold shadow-md transition-transform transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-[#f59f24] focus:ring-offset-2 focus:ring-offset-white"
          >
            Descargar carnet (.pkpass)
          </button>

          <button
            type="button"
            onClick={() => {
              setIsPreview(false);
            }}
            className="text-sm text-slate-600 underline hover:text-slate-800"
          >
            Volver a la pantalla principal
          </button>
        </div>
      </div>
    </div>
  );
}

export default Home;
