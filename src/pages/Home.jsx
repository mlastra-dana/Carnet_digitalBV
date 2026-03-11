import React, { useEffect, useMemo, useRef, useState } from "react";

function Home({ amplifyOutputs }) {
  const [isIntro, setIsIntro] = useState(true);
  const [firstNames, setFirstNames] = useState("");
  const [lastNames, setLastNames] = useState("");
  const [identificationNumber, setIdentificationNumber] = useState("");
  const [email, setEmail] = useState("");
  const [photoDataUrl, setPhotoDataUrl] = useState("");
  const [cameraOn, setCameraOn] = useState(false);
  const [isPreview, setIsPreview] = useState(false);

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const photoFileInputRef = useRef(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem("walletPhoto");
    }
  }, []);

  useEffect(() => {
    if (!cameraOn) return;
    const video = videoRef.current;
    const stream = streamRef.current;
    if (!video || !stream) return;

    // eslint-disable-next-line no-param-reassign
    video.srcObject = stream;
    video.play().catch((error) => {
      console.error("No se pudo reproducir la cámara", error);
    });
  }, [cameraOn]);

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
      stopCamera();
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "user",
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        }
      });
      streamRef.current = stream;
      setCameraOn(true);
    } catch (error) {
      console.error("No se pudo iniciar la cámara", error);
    }
  };

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const sourceWidth = video.videoWidth || 1280;
    const sourceHeight = video.videoHeight || 720;
    const targetRatio = 3 / 4;
    const sourceRatio = sourceWidth / sourceHeight;
    let cropWidth = sourceWidth;
    let cropHeight = sourceHeight;

    if (sourceRatio > targetRatio) {
      cropWidth = Math.floor(sourceHeight * targetRatio);
    } else {
      cropHeight = Math.floor(sourceWidth / targetRatio);
    }

    const sx = Math.floor((sourceWidth - cropWidth) / 2);
    const sy = Math.floor((sourceHeight - cropHeight) / 2);
    const outWidth = 900;
    const outHeight = 1200;
    canvas.width = outWidth;
    canvas.height = outHeight;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(video, sx, sy, cropWidth, cropHeight, 0, 0, outWidth, outHeight);

    const dataUrl = canvas.toDataURL("image/jpeg", 0.92);
    setPhotoDataUrl(dataUrl);
    stopCamera();
  };

  const handlePhotoFileChange = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      stopCamera();
      const fileDataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          if (typeof reader.result === "string") resolve(reader.result);
          else reject(new Error("No se pudo leer la foto."));
        };
        reader.onerror = () => reject(new Error("No se pudo leer la foto."));
        reader.readAsDataURL(file);
      });
      setPhotoDataUrl(fileDataUrl);
    } catch (error) {
      console.error("No se pudo cargar la foto", error);
    }
  };

  useEffect(
    () => () => {
      stopCamera();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const apiBaseUrl = useMemo(() => {
    if (import.meta.env.VITE_API_URL) {
      return import.meta.env.VITE_API_URL;
    }
    if (amplifyOutputs?.apiUrl) {
      return amplifyOutputs.apiUrl;
    }
    return "http://localhost:3001";
  }, [amplifyOutputs]);

  const inputClass =
    "w-full rounded-[8px] border border-[#8a8a8a]/70 px-3 py-2 text-sm text-[#1d2b4f] bg-white focus:outline-none focus:ring-2 focus:ring-[#3864d9] focus:border-[#3864d9]";
  const primaryButtonClass =
    "w-full px-8 py-3 rounded-[20px] bg-[#12a150] hover:bg-[#0f8c46] active:bg-[#0b7439] text-white text-base font-bold shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-[#12a150] focus:ring-offset-2 focus:ring-offset-white";
  const secondaryButtonClass =
    "px-3 py-2 text-xs rounded-[20px] border border-[#3864d9] bg-white hover:bg-[#ecf2ff] text-[#3864d9] font-semibold";

  const handleSubmit = (event) => {
    event.preventDefault();
    setIsPreview(true);
  };

  if (!isPreview && isIntro) {
    const logoUrl =
      "https://cdn.shopify.com/s/files/1/0647/3190/6239/files/LBC_e08bc3c6-2217-4387-9ce3-b1a03ce369aa_250x.png?v=1713204930";

    return (
      <div className="min-h-screen bg-gradient-to-b from-[#3c4c69] to-[#33435f] text-[#1c355c] px-4 py-8 sm:py-12">
        <div className="mx-auto w-full max-w-6xl">
          <div className="rounded-[22px] border border-white/30 bg-white shadow-[0_24px_58px_rgba(11,63,126,0.34)] overflow-hidden">
            <div className="grid lg:grid-cols-[1fr_1fr]">
              <aside className="relative bg-gradient-to-br from-[#3c4c69] via-[#33435f] to-[#2e3c55] p-8 sm:p-10 text-white overflow-hidden">
                <div className="absolute inset-0 opacity-25 bg-[radial-gradient(circle_at_12%_20%,#ffffff_0,transparent_42%)]" />
                <div className="relative">
                  <img src={logoUrl} alt="LBC Seguros" className="h-14 w-auto object-contain" />
                  <p className="mt-10 text-xs uppercase tracking-[0.2em] text-white/75">
                    La Boliviana Ciacruz
                  </p>
                  <h1 className="mt-3 text-3xl sm:text-4xl font-bold leading-tight">
                    LBC Seguros Digital
                  </h1>
                  <p className="mt-4 text-sm text-white/85 max-w-md">
                    Tu seguro, siempre disponible. Genera y descarga tu carnet digital en minutos.
                  </p>
                </div>

                <div className="relative mt-8 rounded-[22px] border border-white/25 bg-white/10 p-5 shadow-[0_18px_36px_rgba(4,31,74,0.28)] backdrop-blur-[2px]">
                  <div className="flex items-center justify-between gap-4">
                    <p className="text-lg font-bold tracking-[0.06em]">LBC SEGUROS</p>
                    <span className="rounded-full bg-[#12a150] px-3 py-1 text-xs font-semibold text-white">
                      Activo
                    </span>
                  </div>
                  <div className="mt-4 h-px bg-white/30" />
                  <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                    <div className="rounded-xl border border-white/25 bg-white/10 p-3">
                      <p className="text-white/70">Cobertura</p>
                      <p className="mt-1 font-semibold">Salud Integral</p>
                    </div>
                    <div className="rounded-xl border border-white/25 bg-white/10 p-3">
                      <p className="text-white/70">Emisión</p>
                      <p className="mt-1 font-semibold">100% Digital</p>
                    </div>
                    <div className="rounded-xl border border-white/25 bg-white/10 p-3 col-span-2">
                      <p className="text-white/70">Beneficio</p>
                      <p className="mt-1 font-semibold">Carnet wallet inmediato</p>
                    </div>
                  </div>
                </div>
              </aside>

              <section className="p-8 sm:p-10 flex items-center">
                <div className="max-w-md">
                  <p className="inline-block rounded-full border border-[#bdd7f6] bg-[#edf5ff] px-3 py-1 text-xs uppercase tracking-[0.14em] text-[#3a7db8] font-semibold">
                    Portal de Asegurados
                  </p>
                  <h2 className="mt-4 text-4xl sm:text-5xl font-extrabold leading-[1.02] text-[#2d75b4]">
                    Registro de carnet digital
                  </h2>
                  <p className="mt-4 text-lg text-[#334f77]">
                    Completa tu registro para obtener tu carnet LBC en formato Wallet.
                  </p>
                  <div className="mt-8">
                    <button
                      type="button"
                      onClick={() => setIsIntro(false)}
                      className="inline-flex items-center rounded-[14px] bg-[#12a150] px-8 py-3 text-white text-lg font-bold shadow-[0_12px_24px_rgba(18,161,80,0.28)] hover:bg-[#0f8c46] active:bg-[#0b7439] transition-colors focus:outline-none focus:ring-2 focus:ring-[#12a150] focus:ring-offset-2"
                    >
                      Iniciar registro
                    </button>
                  </div>
                </div>
              </section>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!isPreview) {
    const logoUrl =
      "https://cdn.shopify.com/s/files/1/0647/3190/6239/files/LBC_e08bc3c6-2217-4387-9ce3-b1a03ce369aa_250x.png?v=1713204930";

    return (
      <div className="min-h-screen bg-[#f3f3f3] text-[#394c6c] px-4 py-8 sm:py-12">
        <div className="mx-auto w-full max-w-6xl overflow-hidden rounded-[22px] border border-[#d9e3fb] bg-white shadow-[0_22px_50px_rgba(13,51,140,0.18)]">
          <div className="grid lg:grid-cols-[1.05fr_1fr]">
            <aside className="relative overflow-hidden bg-gradient-to-br from-[#3864d9] via-[#334fb4] to-[#0064dc] p-7 sm:p-9 text-white">
              <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_20%_20%,#ffffff_0,transparent_42%)]" />
              <div className="absolute -right-24 -bottom-24 h-72 w-72 rounded-full bg-white/10" />
              <div className="relative">
                <img src={logoUrl} alt="LBC Seguros" className="h-14 w-auto object-contain" />
                <p className="mt-10 text-xs uppercase tracking-[0.2em] text-white/70">
                  Seguros Digitales
                </p>
                <h1 className="mt-3 text-3xl sm:text-4xl font-bold leading-tight">
                  Carnet del asegurado
                </h1>
              </div>
            </aside>

            <div className="px-5 py-7 sm:px-8 sm:py-9">
              <form onSubmit={handleSubmit} className="space-y-4 text-left">
                <div>
                  <label className="block text-sm font-semibold text-[#22355d] mb-1">
                    Número de cédula
                  </label>
                  <input
                    type="text"
                    value={identificationNumber}
                    onChange={(e) => setIdentificationNumber(e.target.value)}
                    required
                    className={inputClass}
                    placeholder="Ej: V12345678"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-[#22355d] mb-1">
                    Nombres
                  </label>
                  <input
                    type="text"
                    value={firstNames}
                    onChange={(e) => setFirstNames(e.target.value)}
                    required
                    className={inputClass}
                    placeholder="Ej: Maria Milagros"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-[#22355d] mb-1">
                    Apellidos
                  </label>
                  <input
                    type="text"
                    value={lastNames}
                    onChange={(e) => setLastNames(e.target.value)}
                    required
                    className={inputClass}
                    placeholder="Ej: Lastra Perez"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-[#22355d] mb-1">
                    Correo electrónico
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className={inputClass}
                    placeholder="Ej: persona@correo.com"
                  />
                </div>

                <div className="pt-3 border-t border-[#e4ebfa]">
                  <p className="text-sm font-semibold text-[#3864d9] mb-1">
                    Foto del asegurado (opcional)
                  </p>
                  <p className="text-xs text-[#5f6f8f] mb-3">
                    Puedes activar la cámara o subir una imagen para el carnet.
                  </p>
                  <div className="space-y-3">
                    <div className="mx-auto w-52 h-72 rounded-[10px] border border-[#cfdcf8] bg-[#edf3ff] flex items-center justify-center overflow-hidden">
                      {cameraOn ? (
                        <video
                          ref={videoRef}
                          className="w-full h-full object-cover"
                          autoPlay
                          playsInline
                          muted
                        />
                      ) : photoDataUrl ? (
                        <img
                          src={photoDataUrl}
                          alt="Foto capturada"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span className="text-xs text-[#5f6f8f] px-4 text-center">
                          Sin foto seleccionada
                        </span>
                      )}
                    </div>
                    <input
                      ref={photoFileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handlePhotoFileChange}
                      className="hidden"
                    />
                    <div className="flex flex-wrap items-center justify-center gap-2">
                      {!cameraOn && (
                        <button
                          type="button"
                          onClick={startCamera}
                          className={secondaryButtonClass}
                        >
                          Activar cámara
                        </button>
                      )}
                      {!cameraOn && (
                        <button
                          type="button"
                          onClick={() => photoFileInputRef.current?.click()}
                          className={secondaryButtonClass}
                        >
                          Subir foto
                        </button>
                      )}
                      {cameraOn && (
                        <button
                          type="button"
                          onClick={capturePhoto}
                          className="px-3 py-2 text-xs rounded-[20px] border border-[#00b916] bg-[#00b916] hover:bg-[#00a314] text-white font-semibold"
                        >
                          Capturar foto
                        </button>
                      )}
                      {cameraOn && (
                        <button
                          type="button"
                          onClick={stopCamera}
                          className={secondaryButtonClass}
                        >
                          Detener cámara
                        </button>
                      )}
                      {photoDataUrl && (
                        <button
                          type="button"
                          onClick={() => {
                            setPhotoDataUrl("");
                            if (photoFileInputRef.current) {
                              photoFileInputRef.current.value = "";
                            }
                          }}
                          className={secondaryButtonClass}
                        >
                          Borrar foto
                        </button>
                      )}
                    </div>
                    <canvas ref={canvasRef} className="hidden" />
                  </div>
                </div>

                <div className="pt-2">
                  <button type="submit" className={primaryButtonClass}>
                    Acceder a wallet
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      stopCamera();
                      setIsIntro(true);
                    }}
                    className="mt-3 w-full px-8 py-3 rounded-[20px] border border-[#3c4c69] bg-white hover:bg-[#eef3fb] text-[#3c4c69] text-base font-bold transition-colors focus:outline-none focus:ring-2 focus:ring-[#3c4c69] focus:ring-offset-2 focus:ring-offset-white"
                  >
                    Salir
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const mergedDisplayName = `${firstNames} ${lastNames}`.replace(/\s+/g, " ").trim();
  const displayName = mergedDisplayName || "Juan Pérez";
  const displayEmail = email || "juan.perez@ejemplo.com";
  const displayId = identificationNumber || "V12345678";
  const displayPolicy = `POL-${displayId.replace(/[^0-9]/g, "").slice(-6) || "000001"}`;

  const handleDownloadPkpass = async () => {
    try {
      const photo =
        photoDataUrl || null;

      const response = await fetch(`${apiBaseUrl.replace(/\/+$/, "")}/pkpass`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          name: displayName,
          email: displayEmail,
          photoDataUrl: photo
        })
      });

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
    }
  };

  return (
    <div className="min-h-screen bg-[#f3f3f3] text-[#394c6c] px-4 py-8 sm:py-12">
      <div className="mx-auto max-w-5xl rounded-[22px] border border-[#d9e3fb] bg-white shadow-[0_22px_50px_rgba(13,51,140,0.18)] overflow-hidden">
        <div className="h-16 bg-[#3864d9] flex items-center justify-center">
          <p className="text-sm uppercase tracking-[0.22em] text-white font-bold">
            Seguros Digitales
          </p>
        </div>

        <div className="p-6 sm:p-8 text-center">
          <h1 className="text-2xl font-bold text-[#22355d]">Vista previa del carnet</h1>
          <p className="text-sm text-[#5f6f8f] mt-1">Así se verá el carnet digital del asegurado.</p>
          <div className="mt-6">
            <div className="mx-auto max-w-[420px] rounded-[24px] overflow-hidden shadow-[0_20px_44px_rgba(35,87,202,0.24)] border border-[#b9ccfa] bg-gradient-to-br from-[#3559c4] via-[#2f4da9] to-[#25428f] text-white">
              <div className="px-5 pt-5 pb-4 relative">
                <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_85%_20%,#ffffff_0,transparent_40%)]" />
                <div className="relative flex items-start justify-between gap-4">
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.22em] text-white/75">LBC Seguros</p>
                    <p className="mt-1 text-lg font-bold leading-tight">Carnet del asegurado</p>
                    <p className="text-[11px] text-white/80 mt-1">Seguros Digitales</p>
                  </div>
                  <div className="h-14 w-14 rounded-xl bg-white/12 border border-white/25 flex items-center justify-center text-[11px] font-semibold">
                    LBC
                  </div>
                </div>
              </div>

              <div className="bg-white text-[#22355d] mx-4 rounded-[16px] border border-[#d7e3fd] p-4">
                <div className="grid grid-cols-[1fr_92px] gap-3 items-start">
                  <div className="min-w-0">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-[#5f6f8f]">Asegurado</p>
                    <p className="text-[17px] font-bold leading-tight break-words">{displayName}</p>
                    <div className="mt-3 space-y-1.5">
                      <p className="text-xs">
                        <span className="font-semibold">Cédula:</span> {displayId}
                      </p>
                      <p className="text-xs">
                        <span className="font-semibold">Póliza:</span> {displayPolicy}
                      </p>
                      <p className="text-xs break-all">
                        <span className="font-semibold">Email:</span> {displayEmail}
                      </p>
                    </div>
                  </div>

                  <div className="h-[110px] w-[92px] rounded-[12px] overflow-hidden border border-[#cfdcf8] bg-[#edf3ff]">
                    <img
                      src={
                        photoDataUrl ||
                        "https://media.istockphoto.com/id/1389348844/es/foto/foto-de-estudio-de-una-hermosa-joven-sonriendo-mientras-est%C3%A1-de-pie-sobre-un-fondo-gris.jpg?s=612x612&w=0&k=20&c=kUufmNoTnDcRbyeHhU1wRiip-fNjTWP9owjHf75frFQ="
                      }
                      alt="Foto del asegurado"
                      className="w-full h-full object-cover"
                    />
                  </div>
                </div>

                <div className="mt-4 rounded-[12px] border border-[#d3def9] bg-[#f5f8ff] px-3 py-2">
                  <p className="text-[10px] uppercase tracking-[0.18em] text-[#5f6f8f]">Documento</p>
                  <p className="text-xs font-semibold text-[#2d468f]">Carnet digital de asegurado</p>
                </div>
              </div>

              <div className="px-5 py-3 text-[10px] tracking-[0.14em] uppercase text-white/75">
                Documento digital de asegurado
              </div>
            </div>
          </div>

          <div className="mt-7 space-y-3">
            <button
              type="button"
              onClick={handleDownloadPkpass}
              className="inline-block min-w-64 px-8 py-3 rounded-[20px] bg-[#12a150] hover:bg-[#0f8c46] active:bg-[#0b7439] text-white text-base font-bold shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-[#12a150] focus:ring-offset-2 focus:ring-offset-white"
            >
              Descargar carnet (.pkpass)
            </button>

            <div>
              <button
                type="button"
                onClick={() => {
                  setIsPreview(false);
                }}
                className="text-sm text-[#3864d9] underline hover:text-[#2d56c8]"
              >
                Volver al registro
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Home;
