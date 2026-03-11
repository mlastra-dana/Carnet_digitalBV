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
  const [isReadingId, setIsReadingId] = useState(false);
  const [idReadError, setIdReadError] = useState("");
  const [idReadSuccess, setIdReadSuccess] = useState("");
  const [idReadDebug, setIdReadDebug] = useState("");
  const [idFileName, setIdFileName] = useState("");
  const [idDocumentImageDataUrl, setIdDocumentImageDataUrl] = useState("");
  const [ocrStatus, setOcrStatus] = useState("");
  const [isBiometricRunning, setIsBiometricRunning] = useState(false);
  const [biometricStatus, setBiometricStatus] = useState("");
  const [biometricError, setBiometricError] = useState("");
  const [biometricResult, setBiometricResult] = useState("");
  const [biometricScore, setBiometricScore] = useState(null);

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const photoFileInputRef = useRef(null);
  const idFileInputRef = useRef(null);
  const faceApiRef = useRef(null);
  const faceApiModelsLoadedRef = useRef(false);

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
    resetBiometricState();
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
      resetBiometricState();
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

  const resetBiometricState = () => {
    setBiometricStatus("");
    setBiometricError("");
    setBiometricResult("");
    setBiometricScore(null);
  };

  const normalizeNameText = (value) =>
    (value || "")
      .replace(/[^A-Za-zÀ-ÿ\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim();

  const extractValueByLabel = (lines, labels) => {
    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index];
      const lineUpper = line.toUpperCase();
      const matchedLabel = labels.find((label) => lineUpper.includes(label));
      if (!matchedLabel) continue;

      const inline = line
        .replace(new RegExp(`.*${matchedLabel}\\s*[:\\-]?\\s*`, "i"), "")
        .trim();
      if (inline) return inline;

      const nextLine = (lines[index + 1] || "").trim();
      if (nextLine) return nextLine;
    }
    return "";
  };

  const parseIdCardData = (ocrText) => {
    const lines = (ocrText || "")
      .split("\n")
      .map((line) => line.replace(/\s+/g, " ").trim())
      .filter(Boolean);

    const cleanDetectedField = (value, maxWords = 4) => {
      const cutByDelimiter = (value || "").split(/[|><]/)[0] || "";
      const cleaned = normalizeNameText(cutByDelimiter).toUpperCase();
      const noiseWords = new Set([
        "REPUBLICA",
        "BOLIVARIANA",
        "VENEZUELA",
        "CEDULA",
        "IDENTIDAD",
        "DIRECTOR",
        "NACIMIENTO",
        "EDO",
        "CIVIL",
        "FIRMA",
        "TITULAR",
        "VENEZOLANO",
        "EXPEDICION",
        "VENCIMIENTO",
        "NOMBRES",
        "APELLIDOS",
        "NOMBRE",
        "APELLIDO",
        "DS",
        "DE"
      ]);
      const filtered = cleaned
        .split(" ")
        .filter((word) => word && !noiseWords.has(word))
        .join(" ")
        .trim();

      const stopTokens = [" DIRECTOR", " FIRMA", " TITULAR", " NACIMIENTO", " CIVIL"];
      let truncated = filtered;
      stopTokens.forEach((token) => {
        const idx = truncated.indexOf(token);
        if (idx > 0) truncated = truncated.slice(0, idx).trim();
      });

      const looksLikeNombresPrefix = (word) => {
        const compact = (word || "").replace(/[^A-Z]/g, "");
        if (compact.startsWith("NOMBRE")) return true;
        if (compact.startsWith("NOMBRES")) return true;
        // Variantes OCR comunes de "NOMBRES" (ej: NOUERES, NOBRES)
        return /^N[O0][A-Z]{2,8}(ES|S)$/.test(compact);
      };

      const words = truncated
        .split(" ")
        .filter(Boolean)
        .filter((word, index) => !(index === 0 && looksLikeNombresPrefix(word)));
      return words.slice(0, maxWords).join(" ").trim();
    };

    const extractLabeledField = (field) => {
      const labelRegex =
        field === "APELLIDOS"
          ? /APE[L1I]{1,2}ID[O0]S?\s*[:\-]?\s*(.+)$/i
          : /N[O0]MBR[E3]S?\s*[:\-]?\s*(.+)$/i;
      const maxWords = field === "APELLIDOS" ? 2 : 3;

      for (let i = 0; i < lines.length; i += 1) {
        const line = lines[i];
        const match = line.match(labelRegex);
        if (match?.[1]) {
          const cleaned = cleanDetectedField(match[1], maxWords);
          if (cleaned) return cleaned;
        }

        const upperLine = line.toUpperCase();
        const hasLabel =
          field === "APELLIDOS"
            ? upperLine.includes("APELLIDOS") || upperLine.includes("APELI")
            : upperLine.includes("NOMBRES") || upperLine.includes("NOMBRE");
        if (hasLabel) {
          const nextClean = cleanDetectedField(lines[i + 1] || "", maxWords);
          if (nextClean) return nextClean;
        }
      }
      return "";
    };

    let lastNamesValue = extractLabeledField("APELLIDOS");
    let firstNamesValue = extractLabeledField("NOMBRES");

    if (!firstNamesValue || !lastNamesValue) {
      const candidateLines = lines
        .map((line) => cleanDetectedField(line, 3))
        .filter((line) => line.split(" ").length >= 2);
      if (!lastNamesValue && candidateLines[0]) {
        lastNamesValue = candidateLines[0].split(" ").slice(0, 2).join(" ");
      }
      if (!firstNamesValue && candidateLines[1]) {
        firstNamesValue = candidateLines[1];
      }
    }

    const compactText = lines.join(" ");
    const cedulaWithPrefixMatch =
      compactText.match(/([VE])\s*([0-9]{1,2}(?:[.\s][0-9]{3}){1,2})(?:[.\s]+[0-9]{2,3})?/i) ||
      compactText.match(/([VE])\s*([0-9]{6,9})(?:\s+[0-9]{2,3})?/i);
    const fallbackCedulaMatch = compactText.match(/\b([0-9]{6,9})\b/);
    const documentPrefix = (cedulaWithPrefixMatch?.[1] || "V").toUpperCase();
    const documentDigits = (
      cedulaWithPrefixMatch?.[2] ||
      fallbackCedulaMatch?.[1] ||
      ""
    ).replace(/\D/g, "");
    const documentIdValue = documentDigits
      ? `${documentPrefix}${documentDigits}`
      : "";

    return {
      firstNamesValue,
      lastNamesValue,
      documentIdValue
    };
  };

  const canvasToBlob = (canvas, type = "image/png") =>
    new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error("No se pudo convertir el PDF a imagen para OCR."));
      }, type);
    });

  const blobToDataUrl = (blob) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === "string") resolve(reader.result);
        else reject(new Error("No se pudo convertir el archivo a vista previa."));
      };
      reader.onerror = () =>
        reject(new Error("No se pudo convertir el archivo a vista previa."));
      reader.readAsDataURL(blob);
    });

  const getOcrInputFromFile = async (file) => {
    const isPdf =
      file?.type === "application/pdf" || file?.name?.toLowerCase().endsWith(".pdf");

    if (!isPdf) {
      const previewDataUrl = await blobToDataUrl(file);
      return { input: file, sourceLabel: "imagen", previewDataUrl };
    }

    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    if (pdfjs?.GlobalWorkerOptions) {
      pdfjs.GlobalWorkerOptions.workerSrc = new URL(
        "pdfjs-dist/legacy/build/pdf.worker.min.mjs",
        import.meta.url
      ).toString();
    }

    const pdfBuffer = await file.arrayBuffer();
    const loadingTask = pdfjs.getDocument({ data: pdfBuffer });
    const pdf = await loadingTask.promise;
    const page = await pdf.getPage(1);
    const viewport = page.getViewport({ scale: 2 });
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");

    if (!context) {
      throw new Error("No se pudo renderizar el PDF para OCR.");
    }

    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);
    await page.render({ canvasContext: context, viewport }).promise;
    const renderedBlob = await canvasToBlob(canvas);
    const previewDataUrl = await blobToDataUrl(renderedBlob);

    return { input: renderedBlob, sourceLabel: "pdf (página 1)", previewDataUrl };
  };

  const loadImageFromDataUrl = (dataUrl) =>
    new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () =>
        reject(new Error("No se pudo cargar la imagen para validación biométrica."));
      image.src = dataUrl;
    });

  const getFaceApi = async () => {
    if (faceApiRef.current) return faceApiRef.current;
    const module = await import("face-api.js");
    faceApiRef.current = module;
    return module;
  };

  const loadFaceApiModels = async () => {
    const faceapi = await getFaceApi();
    if (faceApiModelsLoadedRef.current) return faceapi;

    const modelSources = [
      "/models",
      "https://cdn.jsdelivr.net/gh/justadudewhohacks/face-api.js@master/weights",
      "https://justadudewhohacks.github.io/face-api.js/models"
    ];

    setBiometricStatus("Cargando motor biométrico...");
    let lastError = null;

    for (const modelsBaseUrl of modelSources) {
      try {
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri(modelsBaseUrl),
          faceapi.nets.faceLandmark68Net.loadFromUri(modelsBaseUrl),
          faceapi.nets.faceRecognitionNet.loadFromUri(modelsBaseUrl)
        ]);
        faceApiModelsLoadedRef.current = true;
        return faceapi;
      } catch (error) {
        lastError = error;
      }
    }

    throw (
      lastError ||
      new Error(
        "No se pudieron cargar los modelos biométricos desde las fuentes configuradas."
      )
    );
  };

  const detectPrimaryDescriptor = async (faceapi, image) => {
    const detections = await faceapi
      .detectAllFaces(image, new faceapi.TinyFaceDetectorOptions())
      .withFaceLandmarks()
      .withFaceDescriptors();

    if (!detections.length) return null;

    const sorted = [...detections].sort((a, b) => {
      const areaA = a.detection.box.width * a.detection.box.height;
      const areaB = b.detection.box.width * b.detection.box.height;
      return areaB - areaA;
    });
    return sorted[0].descriptor;
  };

  const runBiometricValidation = async () => {
    resetBiometricState();

    if (!idDocumentImageDataUrl) {
      setBiometricError("Primero carga un documento de identidad con foto.");
      return;
    }
    if (!photoDataUrl) {
      setBiometricError("Primero captura o sube la foto del asegurado.");
      return;
    }

    setIsBiometricRunning(true);
    try {
      const faceapi = await loadFaceApiModels();
      setBiometricStatus("Preparando validación biométrica...");

      const [documentImage, selfieImage] = await Promise.all([
        loadImageFromDataUrl(idDocumentImageDataUrl),
        loadImageFromDataUrl(photoDataUrl)
      ]);

      setBiometricStatus("Analizando rostro del documento...");
      const documentDescriptor = await detectPrimaryDescriptor(faceapi, documentImage);
      if (!documentDescriptor) {
        throw new Error("No se detectó rostro en el documento cargado.");
      }

      setBiometricStatus("Analizando selfie del titular...");
      const selfieDescriptor = await detectPrimaryDescriptor(faceapi, selfieImage);
      if (!selfieDescriptor) {
        throw new Error("No se detectó rostro en la foto del asegurado.");
      }

      const distance = faceapi.euclideanDistance(documentDescriptor, selfieDescriptor);
      const threshold = 0.55;
      const score = Math.max(0, Math.min(1, 1 - distance / 0.8));
      const isMatch = distance <= threshold;

      setBiometricScore(score);
      setBiometricResult(isMatch ? "match" : "no_match");
      setBiometricStatus(
        isMatch
          ? "Validación biométrica aprobada."
          : "Validación biométrica no concluyente."
      );
    } catch (error) {
      console.error("Error en validación biométrica", error);
      setBiometricError(error?.message || "No se pudo completar la validación biométrica.");
    } finally {
      setIsBiometricRunning(false);
    }
  };

  const handleIdFileChange = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIdReadError("");
    setIdReadSuccess("");
    setIdReadDebug("");
    setOcrStatus("Preparando análisis del documento...");
    setIdFileName(file.name || "");
    resetBiometricState();
    setIsReadingId(true);

    try {
      const tesseractModule = await import("tesseract.js");
      const recognize =
        tesseractModule?.recognize || tesseractModule?.default?.recognize;

      if (!recognize) {
        throw new Error("No se pudo inicializar OCR en el navegador.");
      }

      const { input: ocrInput, sourceLabel, previewDataUrl } = await getOcrInputFromFile(file);
      setIdDocumentImageDataUrl(previewDataUrl || "");
      const toSpanishStatus = (status) => {
        const normalized = (status || "").toLowerCase();
        if (normalized.includes("loading")) return "Cargando motor OCR...";
        if (normalized.includes("initial")) return "Inicializando análisis...";
        if (normalized.includes("recogn")) return "Analizando documento...";
        if (normalized.includes("resolv")) return "Procesando resultados...";
        return "Analizando documento...";
      };

      const result = await recognize(ocrInput, "spa", {
        logger: (message) => {
          const nextStatus = (message?.status || "").toString();
          if (nextStatus) setOcrStatus(toSpanishStatus(nextStatus));
        }
      });
      const ocrText = result?.data?.text || "";
      if (!ocrText.trim()) {
        throw new Error("OCR no detectó texto legible. Intenta con una foto más nítida.");
      }

      const debugSample = ocrText
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
        .slice(0, 4)
        .join(" | ");
      setIdReadDebug(`OCR ${sourceLabel} (español): ${debugSample}`);

      const { firstNamesValue, lastNamesValue, documentIdValue } = parseIdCardData(
        ocrText
      );

      if (!firstNamesValue && !lastNamesValue && !documentIdValue) {
        throw new Error("No se pudieron detectar nombres o apellidos en la cédula.");
      }

      if (firstNamesValue) setFirstNames(firstNamesValue);
      if (lastNamesValue) setLastNames(lastNamesValue);
      if (documentIdValue) setIdentificationNumber(documentIdValue);

      if (firstNamesValue && lastNamesValue) {
        setIdReadSuccess("Datos detectados y cargados desde la cédula.");
      } else {
        setIdReadSuccess("Lectura parcial: revisa y completa los campos faltantes.");
      }
    } catch (error) {
      console.error("Error leyendo cédula con OCR", error);
      setIdReadError(error?.message || "No se pudo procesar la imagen de cédula.");
    } finally {
      setOcrStatus("");
      setIsReadingId(false);
      if (idFileInputRef.current) {
        idFileInputRef.current.value = "";
      }
    }
  };

  const clearAttachedIdFile = () => {
    setIdFileName("");
    setIdDocumentImageDataUrl("");
    setIdReadError("");
    setIdReadSuccess("");
    setIdReadDebug("");
    setIdentificationNumber("");
    setFirstNames("");
    setLastNames("");
    setOcrStatus("");
    setIsBiometricRunning(false);
    if (idFileInputRef.current) {
      idFileInputRef.current.value = "";
    }
    resetBiometricState();
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    setIsPreview(true);
  };

  if (!isPreview && isIntro) {
    const logoUrl =
      "https://cdn.shopify.com/s/files/1/0647/3190/6239/files/LBC_e08bc3c6-2217-4387-9ce3-b1a03ce369aa_250x.png?v=1713204930";

    return (
      <div className="min-h-screen bg-gradient-to-br from-[#3864d9] via-[#334fb4] to-[#0064dc] text-[#1c355c] px-4 py-8 sm:py-12">
        <div className="mx-auto w-full max-w-6xl">
          <div className="rounded-[22px] border border-white/30 bg-white shadow-[0_24px_58px_rgba(11,63,126,0.34)] overflow-hidden">
            <div className="grid lg:grid-cols-[1fr_1fr]">
              <aside className="relative bg-gradient-to-br from-[#3864d9] via-[#334fb4] to-[#0064dc] p-8 sm:p-10 text-white overflow-hidden">
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
                <div className="rounded-[12px] border border-[#d9e3fb] bg-[#f6f9ff] p-3">
                  <p className="text-sm font-semibold text-[#22355d]">
                    Cargar documento de identidad
                  </p>
                  <p className="mt-1 text-xs text-[#5f6f8f]">
                    Sube una imagen o PDF del documento de identidad para registrar los datos del titular.
                  </p>
                  <input
                    ref={idFileInputRef}
                    type="file"
                    accept="image/*,application/pdf,.pdf"
                    onChange={handleIdFileChange}
                    className="hidden"
                  />
                  <div className="mt-2 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => idFileInputRef.current?.click()}
                      disabled={isReadingId}
                      className={secondaryButtonClass}
                    >
                      {isReadingId ? "Analizando documento..." : "Cargar documento"}
                    </button>
                    {idReadSuccess ? (
                      <p className="text-xs text-[#0f8c46]">{idReadSuccess}</p>
                    ) : null}
                  </div>
                  {isReadingId ? (
                    <div className="mt-2 rounded-[10px] border border-[#d4e1fb] bg-white px-3 py-2">
                      <div className="flex items-center gap-2 text-xs text-[#4b628d]">
                        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-[#eef4ff] text-sm animate-pulse">
                          ⏳
                        </span>
                        <span>{ocrStatus || "Analizando documento..."}</span>
                      </div>
                    </div>
                  ) : null}
                  {idFileName ? (
                    <div className="mt-2 inline-flex items-center gap-2 rounded-full border border-[#bfd3f7] bg-white px-3 py-1">
                      <span className="max-w-[220px] truncate text-xs text-[#34517f]">
                        {idFileName}
                      </span>
                      <button
                        type="button"
                        onClick={clearAttachedIdFile}
                        className="h-5 w-5 rounded-full bg-[#ecf2ff] text-[#34517f] leading-none hover:bg-[#dce8ff]"
                        aria-label="Quitar archivo adjunto"
                      >
                        ×
                      </button>
                    </div>
                  ) : null}
                  {idReadError ? (
                    <p className="mt-2 text-xs text-[#b42318]">{idReadError}</p>
                  ) : null}
                  {idReadDebug ? (
                    <details className="mt-2">
                      <summary className="cursor-pointer select-none text-xs text-[#5f6f8f]">
                        Ver detalle de análisis
                      </summary>
                      <p className="mt-1 text-xs text-[#5f6f8f] break-words">{idReadDebug}</p>
                    </details>
                  ) : null}
                </div>

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
                            resetBiometricState();
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

                <div className="rounded-[12px] border border-[#d9e3fb] bg-[#f6f9ff] p-3">
                  <p className="text-sm font-semibold text-[#22355d]">
                    Validación biométrica
                  </p>
                  <p className="mt-1 text-xs text-[#5f6f8f]">
                    Compara rostro del documento con la foto del titular.
                  </p>
                  <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    <p className="rounded-[8px] bg-white border border-[#d9e3fb] px-2 py-1 text-[#34517f]">
                      Documento: {idDocumentImageDataUrl ? "Listo" : "Pendiente"}
                    </p>
                    <p className="rounded-[8px] bg-white border border-[#d9e3fb] px-2 py-1 text-[#34517f]">
                      Foto titular: {photoDataUrl ? "Lista" : "Pendiente"}
                    </p>
                  </div>
                  <div className="mt-2">
                    <button
                      type="button"
                      onClick={runBiometricValidation}
                      disabled={isBiometricRunning}
                      className="px-3 py-2 text-xs rounded-[20px] border border-[#12a150] bg-[#12a150] hover:bg-[#0f8c46] text-white font-semibold disabled:opacity-70"
                    >
                      {isBiometricRunning ? "Validando..." : "Validar biometría"}
                    </button>
                  </div>
                  {biometricStatus ? (
                    <p className="mt-2 text-xs text-[#34517f]">{biometricStatus}</p>
                  ) : null}
                  {biometricError ? (
                    <p className="mt-2 text-xs text-[#b42318]">{biometricError}</p>
                  ) : null}
                  {biometricResult ? (
                    <p
                      className={`mt-2 text-xs font-semibold ${
                        biometricResult === "match" ? "text-[#0f8c46]" : "text-[#b42318]"
                      }`}
                    >
                      {biometricResult === "match"
                        ? "Coincidencia biométrica: Aprobada"
                        : "Coincidencia biométrica: Revisar manualmente"}
                      {typeof biometricScore === "number"
                        ? ` (${Math.round(biometricScore * 100)}%)`
                        : ""}
                    </p>
                  ) : null}
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
  const demoQrData = `LBC|${displayId}|${displayPolicy}|${displayEmail}`;
  const demoQrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=0&data=${encodeURIComponent(
    demoQrData
  )}`;

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

                <div className="mt-4 rounded-[12px] border border-[#d3def9] bg-white px-3 py-3">
                  <div className="flex items-center justify-center">
                    <img
                      src={demoQrUrl}
                      alt="Código QR del carnet"
                      className="h-24 w-24 rounded-[8px] border border-[#d3def9] bg-white"
                    />
                  </div>
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
