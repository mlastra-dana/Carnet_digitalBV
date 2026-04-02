import React, { useEffect, useMemo, useRef, useState } from "react";

function Home({ amplifyOutputs }) {
  const [isIntro, setIsIntro] = useState(true);
  const [registrationStep, setRegistrationStep] = useState(1);
  const [firstNames, setFirstNames] = useState("");
  const [lastNames, setLastNames] = useState("");
  const [identificationNumber, setIdentificationNumber] = useState("");
  const [email, setEmail] = useState("");
  const [photoDataUrl, setPhotoDataUrl] = useState("");
  const [portraitCameraOn, setPortraitCameraOn] = useState(false);
  const [livenessCameraOn, setLivenessCameraOn] = useState(false);
  const [isPreview, setIsPreview] = useState(false);
  const [isReadingId, setIsReadingId] = useState(false);
  const [idReadError, setIdReadError] = useState("");
  const [idReadSuccess, setIdReadSuccess] = useState("");
  const [idFileName, setIdFileName] = useState("");
  const [idDocumentImageDataUrl, setIdDocumentImageDataUrl] = useState("");
  const [ocrStatus, setOcrStatus] = useState("");
  const [isLivenessRunning, setIsLivenessRunning] = useState(false);
  const [livenessApproved, setLivenessApproved] = useState(false);
  const [livenessStatus, setLivenessStatus] = useState("");
  const [livenessError, setLivenessError] = useState("");
  const [livenessStepIndex, setLivenessStepIndex] = useState(0);
  const [livenessPreviewDataUrl, setLivenessPreviewDataUrl] = useState("");
  const [conversationStatus, setConversationStatus] = useState("");
  const [conversationError, setConversationError] = useState("");
  const [isSendingConversation, setIsSendingConversation] = useState(false);

  const portraitVideoRef = useRef(null);
  const portraitCanvasRef = useRef(null);
  const portraitStreamRef = useRef(null);
  const livenessVideoRef = useRef(null);
  const livenessCanvasRef = useRef(null);
  const livenessStreamRef = useRef(null);
  const faceDetectorRef = useRef(null);
  const photoFileInputRef = useRef(null);
  const idFileInputRef = useRef(null);
  const livenessFramesRef = useRef([]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem("walletPhoto");
    }
  }, []);

  useEffect(() => {
    if (!portraitCameraOn) return;
    const video = portraitVideoRef.current;
    const stream = portraitStreamRef.current;
    if (!video || !stream) return;

    // eslint-disable-next-line no-param-reassign
    video.srcObject = stream;
    video.play().catch((error) => {
      console.error("No se pudo reproducir la cámara de retrato", error);
    });
  }, [portraitCameraOn]);

  useEffect(() => {
    if (!livenessCameraOn) return;
    const video = livenessVideoRef.current;
    const stream = livenessStreamRef.current;
    if (!video || !stream) return;

    // eslint-disable-next-line no-param-reassign
    video.srcObject = stream;
    video.play().catch((error) => {
      console.error("No se pudo reproducir la cámara de prueba de vida", error);
    });
  }, [livenessCameraOn]);

  const stopPortraitCamera = () => {
    const stream = portraitStreamRef.current;
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      portraitStreamRef.current = null;
    }
    if (portraitVideoRef.current) {
      // eslint-disable-next-line no-param-reassign
      portraitVideoRef.current.srcObject = null;
    }
    setPortraitCameraOn(false);
  };

  const stopLivenessCamera = () => {
    const stream = livenessStreamRef.current;
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      livenessStreamRef.current = null;
    }
    if (livenessVideoRef.current) {
      // eslint-disable-next-line no-param-reassign
      livenessVideoRef.current.srcObject = null;
    }
    setLivenessCameraOn(false);
  };

  const stopAllCameras = () => {
    stopPortraitCamera();
    stopLivenessCamera();
  };

  const startPortraitCamera = async () => {
    if (typeof navigator === "undefined" || !navigator.mediaDevices) return;
    try {
      stopPortraitCamera();
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "user",
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        }
      });
      portraitStreamRef.current = stream;
      setPortraitCameraOn(true);
    } catch (error) {
      console.error("No se pudo iniciar la cámara de retrato", error);
    }
  };

  const startLivenessCamera = async () => {
    if (typeof navigator === "undefined" || !navigator.mediaDevices) return;
    try {
      stopLivenessCamera();
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "user",
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      });
      livenessStreamRef.current = stream;
      setLivenessCameraOn(true);
    } catch (error) {
      console.error("No se pudo iniciar la cámara para prueba de vida", error);
    }
  };

  const capturePhoto = () => {
    if (!portraitVideoRef.current || !portraitCanvasRef.current) return;
    const video = portraitVideoRef.current;
    const canvas = portraitCanvasRef.current;
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
    stopPortraitCamera();
  };

  const handlePhotoFileChange = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      stopPortraitCamera();
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
      stopAllCameras();
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

  const resetLivenessState = () => {
    setLivenessStatus("");
    setLivenessError("");
    setLivenessApproved(false);
    setLivenessStepIndex(0);
    setLivenessPreviewDataUrl("");
    livenessFramesRef.current = [];
  };

  const normalizeNameText = (value) =>
    (value || "")
      .replace(/[^A-Za-zÀ-ÿ\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim();

  const cleanBoliviaNameValue = (value, maxWords = 4) => {
    const cleaned = normalizeNameText((value || "").split(/[|><]/)[0] || "")
      .toUpperCase()
      .replace(/\s+/g, " ")
      .trim();

    const noiseWords = new Set([
      "ESTADO",
      "PLURINACIONAL",
      "BOLIVIA",
      "SERVICIO",
      "GENERAL",
      "IDENTIFICACION",
      "PERSONAL",
      "NACIMIENTO",
      "NACIONALIDAD",
      "FIRMA",
      "TITULAR",
      "CARNET",
      "IDENTIDAD",
      "APELLIDO",
      "APELLIDOS",
      "NOMBRE",
      "NOMBRES",
      "CI",
      "SEGIP",
      "NUMERO",
      "DOCUMENTO"
    ]);

    const filtered = cleaned
      .split(" ")
      .filter((word) => word && !noiseWords.has(word))
      .join(" ")
      .trim();

    return filtered
      .split(" ")
      .filter(Boolean)
      .slice(0, maxWords)
      .join(" ")
      .trim();
  };

  const extractLabeledBoliviaField = (lines, labels, maxWords = 3) => {
    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index];
      const lineUpper = line.toUpperCase();
      const matchedLabel = labels.find((label) => lineUpper.includes(label));
      if (!matchedLabel) continue;

      const inline = line
        .replace(new RegExp(`.*${matchedLabel}\\s*[:\\-]?\\s*`, "i"), "")
        .trim();
      const cleanInline = cleanBoliviaNameValue(inline, maxWords);
      if (cleanInline) return cleanInline;

      const nextLine = cleanBoliviaNameValue(lines[index + 1] || "", maxWords);
      if (nextLine) return nextLine;
    }
    return "";
  };

  const formatBoliviaDocumentId = (digits, complement, expedition) => {
    if (!digits) return "";
    const normalizedComplement = (complement || "").replace(/[^0-9A-Z]/gi, "").toUpperCase();
    const normalizedExpedition = (expedition || "").replace(/[^A-Z]/gi, "").toUpperCase();
    return [
      `${digits}${normalizedComplement ? `-${normalizedComplement}` : ""}`,
      normalizedExpedition
    ]
      .filter(Boolean)
      .join(" ")
      .trim();
  };

  const extractBoliviaDocumentId = (lines) => {
    const joinedText = lines.join(" ");
    const labelFocusedText = lines
      .filter((line) =>
        /(C[.\s]?I\b|CARNET|NRO|Nº|N°|NUMERO|DOCUMENTO|IDENTIDAD)/i.test(line)
      )
      .join(" ");
    const searchText = `${labelFocusedText} ${joinedText}`.trim();
    const docRegex =
      /\b([0-9]{5,10})(?:\s*[-.]\s*([0-9A-Z]{1,3}))?(?:\s+(LP|CB|SC|OR|PT|CH|TJ|BE|PD))?\b/gi;

    let bestMatch = null;
    let currentMatch = docRegex.exec(searchText);
    while (currentMatch) {
      const digits = (currentMatch[1] || "").replace(/\D/g, "");
      const complement = (currentMatch[2] || "").toUpperCase();
      const expedition = (currentMatch[3] || "").toUpperCase();
      if (digits.length >= 5 && digits.length <= 10) {
        if (!bestMatch || digits.length > bestMatch.digits.length) {
          bestMatch = { digits, complement, expedition };
        }
      }
      currentMatch = docRegex.exec(searchText);
    }

    if (!bestMatch) return "";
    return formatBoliviaDocumentId(
      bestMatch.digits,
      bestMatch.complement,
      bestMatch.expedition
    );
  };

  const parseBoliviaIdCardData = (ocrText) => {
    const lines = (ocrText || "")
      .split("\n")
      .map((line) => line.replace(/\s+/g, " ").trim())
      .filter(Boolean);

    const apellidoPaterno = extractLabeledBoliviaField(
      lines,
      ["APELLIDO PATERNO", "PRIMER APELLIDO"],
      2
    );
    const apellidoMaterno = extractLabeledBoliviaField(
      lines,
      ["APELLIDO MATERNO", "SEGUNDO APELLIDO"],
      2
    );
    const genericLastNames = extractLabeledBoliviaField(lines, ["APELLIDOS", "APELLIDO"], 3);
    let lastNamesValue = [apellidoPaterno, apellidoMaterno].filter(Boolean).join(" ").trim();
    if (!lastNamesValue) {
      lastNamesValue = genericLastNames;
    }

    let firstNamesValue = extractLabeledBoliviaField(
      lines,
      ["NOMBRES", "NOMBRE"],
      3
    );

    if (!firstNamesValue || !lastNamesValue) {
      const candidateLines = lines
        .map((line) => cleanBoliviaNameValue(line, 3))
        .filter((line) => line.split(" ").length >= 2);
      if (!lastNamesValue && candidateLines[0]) {
        lastNamesValue = candidateLines[0].split(" ").slice(0, 2).join(" ");
      }
      if (!firstNamesValue && candidateLines[1]) {
        firstNamesValue = candidateLines[1];
      }
    }

    const documentIdValue = extractBoliviaDocumentId(lines);

    return {
      firstNamesValue,
      lastNamesValue,
      documentIdValue
    };
  };

  const canvasToBlob = (canvas, type = "image/png", quality) =>
    new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error("No se pudo convertir el PDF a imagen para OCR."));
      }, type, quality);
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

  const preprocessImageDataUrlForOcr = async (dataUrl) => {
    const image = await loadImageFromDataUrl(dataUrl);
    const scale = image.width < 1400 ? 2 : 1.4;
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("No se pudo preparar la imagen para OCR.");
    }

    canvas.width = Math.max(1200, Math.floor(image.width * scale));
    canvas.height = Math.max(700, Math.floor(image.height * scale));

    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.drawImage(image, 0, 0, canvas.width, canvas.height);

    const frame = context.getImageData(0, 0, canvas.width, canvas.height);
    const data = frame.data;
    let luminanceSum = 0;

    for (let i = 0; i < data.length; i += 4) {
      const gray = data[i] * 0.3 + data[i + 1] * 0.59 + data[i + 2] * 0.11;
      luminanceSum += gray;
    }

    const average = luminanceSum / (data.length / 4 || 1);
    const threshold = Math.max(105, Math.min(180, average * 0.95));

    for (let i = 0; i < data.length; i += 4) {
      const gray = data[i] * 0.3 + data[i + 1] * 0.59 + data[i + 2] * 0.11;
      const boosted = Math.max(0, Math.min(255, (gray - 128) * 1.8 + 128));
      const bin = boosted > threshold ? 255 : 0;
      data[i] = bin;
      data[i + 1] = bin;
      data[i + 2] = bin;
    }

    context.putImageData(frame, 0, 0);
    return canvasToBlob(canvas, "image/jpeg", 0.9);
  };

  const getOcrInputFromFile = async (file) => {
    const isPdf =
      file?.type === "application/pdf" || file?.name?.toLowerCase().endsWith(".pdf");

    if (!isPdf) {
      const previewDataUrl = await blobToDataUrl(file);
      const enhanced = await preprocessImageDataUrlForOcr(previewDataUrl);
      return {
        sourceLabel: "imagen",
        previewDataUrl,
        ocrCandidates: [
          { input: enhanced, label: "imagen optimizada" },
          { input: file, label: "imagen original" }
        ]
      };
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
    const enhanced = await preprocessImageDataUrlForOcr(previewDataUrl);

    return {
      sourceLabel: "pdf (página 1)",
      previewDataUrl,
      ocrCandidates: [
        { input: enhanced, label: "pdf optimizado" },
        { input: renderedBlob, label: "pdf original" }
      ]
    };
  };

  const loadImageFromDataUrl = (dataUrl) =>
    new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () =>
        reject(new Error("No se pudo cargar imagen para la prueba de vida."));
      image.src = dataUrl;
    });

  const calculateFrameDifference = async (firstFrame, secondFrame) => {
    const [imgA, imgB] = await Promise.all([
      loadImageFromDataUrl(firstFrame),
      loadImageFromDataUrl(secondFrame)
    ]);
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    if (!context) return 0;
    canvas.width = 96;
    canvas.height = 96;

    const getPixels = (image) => {
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      return context.getImageData(0, 0, canvas.width, canvas.height).data;
    };

    const pixelsA = getPixels(imgA);
    const pixelsB = getPixels(imgB);
    let diffSum = 0;
    for (let i = 0; i < pixelsA.length; i += 4) {
      const grayA = (pixelsA[i] + pixelsA[i + 1] + pixelsA[i + 2]) / 3;
      const grayB = (pixelsB[i] + pixelsB[i + 1] + pixelsB[i + 2]) / 3;
      diffSum += Math.abs(grayA - grayB) / 255;
    }
    return diffSum / (pixelsA.length / 4);
  };

  const getFaceDetector = () => {
    if (typeof window === "undefined" || typeof window.FaceDetector === "undefined") {
      return null;
    }
    if (!faceDetectorRef.current) {
      faceDetectorRef.current = new window.FaceDetector({
        fastMode: true,
        maxDetectedFaces: 1
      });
    }
    return faceDetectorRef.current;
  };

  const detectSingleFaceMetrics = async (detector, canvas) => {
    const faces = await detector.detect(canvas);
    if (!faces?.length) {
      throw new Error("No se detectó el rostro. Mantén tu cara dentro del recuadro.");
    }
    if (faces.length > 1) {
      throw new Error("Se detectaron varios rostros. Realiza la prueba con una sola persona.");
    }

    const box = faces[0]?.boundingBox;
    if (!box?.width || !box?.height) {
      throw new Error("No se pudo medir el rostro. Ajusta iluminación y distancia.");
    }

    return {
      centerX: box.x + box.width / 2,
      centerY: box.y + box.height / 2,
      area: box.width * box.height
    };
  };

  const waitForVideoReady = (video, timeoutMs = 4000) =>
    new Promise((resolve, reject) => {
      if (!video) {
        reject(new Error("No se pudo inicializar la cámara."));
        return;
      }
      if (video.readyState >= 2 && video.videoWidth > 0 && video.videoHeight > 0) {
        resolve();
        return;
      }

      const timeoutId = window.setTimeout(() => {
        cleanup();
        reject(new Error("La cámara tardó demasiado en iniciar."));
      }, timeoutMs);

      const onReady = () => {
        cleanup();
        resolve();
      };

      const cleanup = () => {
        window.clearTimeout(timeoutId);
        video.removeEventListener("loadeddata", onReady);
        video.removeEventListener("canplay", onReady);
      };

      video.addEventListener("loadeddata", onReady);
      video.addEventListener("canplay", onReady);
    });

  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  const captureLivenessFrame = (ctx, video, canvas) => {
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.9);
  };

  const completeLivenessStepWithDetector = async ({
    stepIndex,
    detector,
    ctx,
    video,
    canvas,
    baselineCenterX,
    baselineArea,
    sideDirection
  }) => {
    const startedAt = Date.now();
    const maxStepMs = 9000;
    const minStepMs = 1400;
    const requiredStableFrames = 3;
    let stableFrames = 0;
    let lastError = "No se pudo detectar el rostro.";

    while (Date.now() - startedAt < maxStepMs) {
      try {
        const frameData = captureLivenessFrame(ctx, video, canvas);
        const metrics = await detectSingleFaceMetrics(detector, canvas);
        const normalizedX = metrics.centerX / canvas.width;

        if (stepIndex === 0) {
          if (Math.abs(normalizedX - 0.5) <= 0.12) {
            stableFrames += 1;
            if (Date.now() - startedAt >= minStepMs && stableFrames >= requiredStableFrames) {
              return {
                frameData,
                metrics,
                baselineCenterX: metrics.centerX,
                baselineArea: metrics.area,
                sideDirection: 0
              };
            }
          } else {
            stableFrames = 0;
          }
        } else if (stepIndex === 1 && baselineCenterX && baselineArea) {
          const horizontalDelta = (metrics.centerX - baselineCenterX) / canvas.width;
          const areaRatio = metrics.area / Math.max(1, baselineArea);
          const minHorizontalMove = 0.08;
          if (Math.abs(horizontalDelta) >= minHorizontalMove && areaRatio > 0.55 && areaRatio < 1.9) {
            stableFrames += 1;
            if (Date.now() - startedAt >= minStepMs && stableFrames >= requiredStableFrames) {
              return {
                frameData,
                metrics,
                baselineCenterX,
                baselineArea,
                sideDirection: horizontalDelta > 0 ? 1 : -1
              };
            }
          } else {
            stableFrames = 0;
          }
        } else if (stepIndex === 2 && baselineCenterX && sideDirection) {
          const horizontalDelta = (metrics.centerX - baselineCenterX) / canvas.width;
          const movedOpposite = sideDirection > 0 ? horizontalDelta < -0.08 : horizontalDelta > 0.08;
          if (movedOpposite) {
            stableFrames += 1;
            if (Date.now() - startedAt >= minStepMs && stableFrames >= requiredStableFrames) {
              return {
                frameData,
                metrics,
                baselineCenterX,
                baselineArea,
                sideDirection
              };
            }
          } else {
            stableFrames = 0;
          }
        }
      } catch (error) {
        lastError = error?.message || lastError;
      }
      await wait(260);
    }

    if (stepIndex === 0) {
      throw new Error("No se detectó posición frontal. Mira al frente y mantén el rostro centrado.");
    }
    if (stepIndex === 1) {
      throw new Error(
        "No se detectó giro lateral. Gira levemente tu rostro hacia un lado para continuar."
      );
    }
    if (stepIndex === 2) {
      throw new Error(
        "No se detectó giro al lado contrario. Completa el último movimiento para finalizar."
      );
    }
    throw new Error(lastError);
  };

  const completeLivenessStepWithFallback = async ({
    stepIndex,
    ctx,
    video,
    canvas,
    previousFrameData
  }) => {
    const startedAt = Date.now();
    const maxStepMs = 9000;
    const minStepMs = 1400;
    const requiredStableFrames = 3;
    let stableFrames = 0;

    if (stepIndex === 0) {
      await wait(minStepMs);
      return {
        frameData: captureLivenessFrame(ctx, video, canvas)
      };
    }

    while (Date.now() - startedAt < maxStepMs) {
      const frameData = captureLivenessFrame(ctx, video, canvas);
      const diff = await calculateFrameDifference(previousFrameData, frameData);
      if (diff >= 0.055) {
        stableFrames += 1;
        if (Date.now() - startedAt >= minStepMs && stableFrames >= requiredStableFrames) {
          return { frameData };
        }
      } else {
        stableFrames = 0;
      }
      await wait(260);
    }

    throw new Error(
      "No se detectó movimiento suficiente en este paso. Realiza el gesto indicado para continuar."
    );
  };

  const runLivenessCheck = async () => {
    if (!livenessCameraOn) {
      await startLivenessCamera();
      await new Promise((resolve) => setTimeout(resolve, 350));
    }
    if (!livenessVideoRef.current || !livenessCanvasRef.current || !livenessStreamRef.current) {
      setLivenessError("No se pudo activar la cámara para la prueba de vida.");
      return;
    }

    setLivenessError("");
    setLivenessStatus("Iniciando prueba de vida...");
    setIsLivenessRunning(true);
    setLivenessApproved(false);
    setLivenessStepIndex(0);
    setLivenessPreviewDataUrl("");
    livenessFramesRef.current = [];

    const video = livenessVideoRef.current;
    const canvas = livenessCanvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      setLivenessError("No se pudo inicializar la prueba de vida.");
      setIsLivenessRunning(false);
      return;
    }

    const challenges = [
      "Mira al frente",
      "Gira levemente hacia un lado",
      "Ahora gira hacia el lado contrario"
    ];

    try {
      await waitForVideoReady(video);
      canvas.width = 480;
      canvas.height = 640;
      const detector = getFaceDetector();
      let baselineCenterX = 0;
      let baselineArea = 0;
      let sideDirection = 0;

      for (let index = 0; index < challenges.length; index += 1) {
        setLivenessStepIndex(index + 1);
        setLivenessStatus(`${index + 1}/3: ${challenges[index]}...`);
        await wait(350);

        if (detector) {
          const stepResult = await completeLivenessStepWithDetector({
            stepIndex: index,
            detector,
            ctx,
            video,
            canvas,
            baselineCenterX,
            baselineArea,
            sideDirection
          });
          baselineCenterX = stepResult.baselineCenterX || baselineCenterX;
          baselineArea = stepResult.baselineArea || baselineArea;
          sideDirection = stepResult.sideDirection || sideDirection;
          livenessFramesRef.current.push(stepResult.frameData);
        } else {
          const stepResult = await completeLivenessStepWithFallback({
            stepIndex: index,
            ctx,
            video,
            canvas,
            previousFrameData: livenessFramesRef.current[index - 1]
          });
          livenessFramesRef.current.push(stepResult.frameData);
        }
      }

      const [frame1, frame2, frame3] = livenessFramesRef.current;
      const [diff12, diff23, diff13] = await Promise.all([
        calculateFrameDifference(frame1, frame2),
        calculateFrameDifference(frame2, frame3),
        calculateFrameDifference(frame1, frame3)
      ]);
      const minStepMotion = 0.035;
      const totalMotion = 0.055;
      const strongStepMotion = 0.065;
      const maxStep = Math.max(diff12, diff23);

      const fallbackMotionFailed =
        diff12 < minStepMotion ||
        diff23 < minStepMotion ||
        diff13 < totalMotion ||
        maxStep < strongStepMotion;

      if (fallbackMotionFailed) {
        throw new Error(
          "No se detectó suficiente movimiento. Repite la prueba moviendo el rostro según las indicaciones."
        );
      }

      setLivenessPreviewDataUrl(frame1);
      setLivenessApproved(true);
      setLivenessStatus("Prueba de vida aprobada.");
      stopLivenessCamera();
    } catch (error) {
      console.error("Error en prueba de vida", error);
      setLivenessError(error?.message || "No se pudo completar la prueba de vida.");
      setLivenessStatus("");
      setLivenessApproved(false);
    } finally {
      setIsLivenessRunning(false);
    }
  };

  const handleIdFileChange = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIdReadError("");
    setIdReadSuccess("");
    setOcrStatus("Preparando análisis del documento...");
    setIdFileName(file.name || "");
    resetLivenessState();
    setIsReadingId(true);

    try {
      const { ocrCandidates, sourceLabel, previewDataUrl } = await getOcrInputFromFile(file);
      setIdDocumentImageDataUrl(previewDataUrl || "");
      setOcrStatus("Enviando documento al servidor...");

      const attempts = [];
      const attemptErrors = [];
      for (let i = 0; i < ocrCandidates.length; i += 1) {
        const candidate = ocrCandidates[i];
        setOcrStatus(`Validando ${candidate.label}...`);
        try {
          const candidateDataUrl = await blobToDataUrl(candidate.input);
          const response = await fetch(`${getOcrApiBaseUrl()}/ocr-id`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              imageBase64: candidateDataUrl,
              sourceLabel: `${sourceLabel} - ${candidate.label}`
            })
          });

          if (!response.ok) {
            const errorPayload = await response.json().catch(() => ({}));
            const serverMessage = (errorPayload?.message || "").toString();
            const errorMessage =
              serverMessage && !/backend/i.test(serverMessage)
                ? serverMessage
                : "No se pudo validar el documento.";
            throw new Error(errorMessage);
          }

          const result = await response.json();
          const extractedCount = [
            result?.firstNamesValue,
            result?.lastNamesValue,
            result?.documentIdValue
          ].filter(Boolean).length;
          const confidence = Number(result?.confidence || 0);
          const score = extractedCount * 100 + confidence + (i === 0 ? 10 : 0);
          attempts.push({
            label: candidate.label,
            debugSample: result?.debugSample || "",
            parsed: {
              firstNamesValue: result?.firstNamesValue || "",
              lastNamesValue: result?.lastNamesValue || "",
              documentIdValue: result?.documentIdValue || ""
            },
            score
          });
        } catch (attemptError) {
          attemptErrors.push(
            `${candidate.label}: ${attemptError?.message || "Error de validación del documento."}`
          );
        }
      }

      if (attempts.length === 0) {
        throw new Error(attemptErrors[0] || "No se pudo validar el documento.");
      }

      const bestAttempt = attempts.sort((a, b) => b.score - a.score)[0];
      if (
        !bestAttempt?.parsed?.firstNamesValue &&
        !bestAttempt?.parsed?.lastNamesValue &&
        !bestAttempt?.parsed?.documentIdValue
      ) {
        throw new Error("OCR no detectó texto legible. Intenta con una foto más nítida.");
      }

      const { firstNamesValue, lastNamesValue, documentIdValue } = bestAttempt.parsed;

      if (!firstNamesValue && !lastNamesValue && !documentIdValue) {
        throw new Error("No se pudieron detectar nombres o número de documento.");
      }

      if (firstNamesValue) setFirstNames(firstNamesValue);
      if (lastNamesValue) setLastNames(lastNamesValue);
      if (documentIdValue) setIdentificationNumber(documentIdValue);

      if (firstNamesValue && lastNamesValue) {
        setIdReadSuccess("Datos detectados y cargados desde el documento.");
      } else {
        setIdReadSuccess("Lectura parcial: revisa y completa los campos faltantes.");
      }
    } catch (error) {
      console.error("Error leyendo documento con OCR", error);
      setIdReadError(error?.message || "No se pudo procesar la imagen del carnet de identidad.");
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
    setIdentificationNumber("");
    setFirstNames("");
    setLastNames("");
    setOcrStatus("");
    setIsLivenessRunning(false);
    if (idFileInputRef.current) {
      idFileInputRef.current.value = "";
    }
    resetLivenessState();
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    setRegistrationStep(2);
    resetLivenessState();
    setLivenessError("");
    setLivenessStatus("");
    setConversationStatus("");
    setConversationError("");
    stopLivenessCamera();
  };

  const getPkpassApiBaseUrl = () =>
    (import.meta.env.VITE_PKPASS_API_URL || apiBaseUrl).replace(/\/+$/, "");
  const getOcrApiBaseUrl = () =>
    (import.meta.env.VITE_OCR_API_URL || getPkpassApiBaseUrl()).replace(/\/+$/, "");

  const buildPkpassBlob = async () => {
    const fullName = `${firstNames} ${lastNames}`.replace(/\s+/g, " ").trim();
    const payload = {
      name: fullName || "Cliente",
      email: (email || "").trim(),
      photoDataUrl: photoDataUrl || null
    };

    const response = await fetch(`${getPkpassApiBaseUrl()}/pkpass`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error("No se pudo generar el archivo PKPASS.");
    }

    return response.blob();
  };

  const blobToBase64 = (blob) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result !== "string") {
          reject(new Error("No se pudo convertir PKPASS a base64."));
          return;
        }
        const base64 = reader.result.split(",")[1] || "";
        resolve(base64);
      };
      reader.onerror = () => reject(new Error("No se pudo convertir PKPASS a base64."));
      reader.readAsDataURL(blob);
    });

  const startDanaConversation = async () => {
    const fullName = `${firstNames} ${lastNames}`.replace(/\s+/g, " ").trim();
    const safeDocumentId = (identificationNumber || "").trim();
    let pkpassBase64 = "";

    try {
      const pkpassBlob = await buildPkpassBlob();
      pkpassBase64 = await blobToBase64(pkpassBlob);
    } catch (error) {
      console.warn("No se pudo generar el PKPASS para S3. Se enviara como pendiente.", error);
    }

    const payload = {
      NOMBRECLIENTE: fullName || "Cliente",
      DOCUMENT_ID: safeDocumentId,
      EMAIL: (email || "").trim(),
      PKPASS: "pendiente",
      ...(pkpassBase64
        ? {
            PKPASS_BASE64: pkpassBase64,
            PKPASS_FILE_NAME: `carnet-${safeDocumentId || "asegurado"}.pkpass`
          }
        : {})
    };

    const response = await fetch(
      `${apiBaseUrl.replace(/\/+$/, "")}/start-conversation`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      }
    );

    if (!response.ok) {
      throw new Error("No se pudo iniciar la conversación en DANA.");
    }
  };

  const handleFinishRegistration = () => {
    setConversationStatus("");
    setConversationError("");
    setIsPreview(true);
  };

  const handleCompleteRegistration = async () => {
    setConversationStatus("Enviando datos a DANA...");
    setConversationError("");
    setIsSendingConversation(true);

    try {
      await startDanaConversation();
      setConversationStatus("Registro completado. Conversación iniciada en DANA.");
    } catch (error) {
      console.error("Error iniciando conversación en DANA", error);
      setConversationStatus("");
      setConversationError(
        "No se pudo iniciar la conversación en DANA. Revisa conexión o credenciales."
      );
    } finally {
      setIsSendingConversation(false);
    }
  };

  const goToHomeStart = () => {
    stopAllCameras();
    setConversationStatus("");
    setConversationError("");
    setIsPreview(false);
    setRegistrationStep(1);
    setIsIntro(true);
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
                      onClick={() => {
                        setIsIntro(false);
                        setRegistrationStep(1);
                      }}
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
                    Sube foto o PDF del documento para extraer nombres y número automáticamente.
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
                </div>

                {registrationStep === 1 ? (
                  <>
                    <div>
                      <label className="block text-sm font-semibold text-[#22355d] mb-1">
                        Número de documento
                      </label>
                      <input
                        type="text"
                        value={identificationNumber}
                        onChange={(e) => setIdentificationNumber(e.target.value)}
                        required
                        className={inputClass}
                        placeholder="Ej: 12345678 o 12345678-1 LP"
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
                  </>
                ) : null}

                {registrationStep === 2 ? (
                  <>
                  <div className="pt-3 border-t border-[#e4ebfa]">
                  <p className="text-sm font-semibold text-[#3864d9] mb-1">
                    Módulo retrato para el carnet
                  </p>
                  <p className="text-xs text-[#5f6f8f] mb-3">
                    Captura o sube un retrato del titular para mostrarlo en el carnet digital.
                  </p>
                  <div className="space-y-3">
                    <div className="mx-auto w-52 h-72 rounded-[10px] border border-[#cfdcf8] bg-[#edf3ff] flex items-center justify-center overflow-hidden">
                      {portraitCameraOn ? (
                        <video
                          ref={portraitVideoRef}
                          className="w-full h-full object-cover"
                          autoPlay
                          playsInline
                          muted
                        />
                      ) : photoDataUrl ? (
                        <img
                          src={photoDataUrl}
                          alt="Retrato del titular"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span className="text-xs text-[#5f6f8f] px-4 text-center">
                          Activa cámara para iniciar
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
                      {!portraitCameraOn && (
                        <button
                          type="button"
                          onClick={startPortraitCamera}
                          className={secondaryButtonClass}
                        >
                          Activar cámara
                        </button>
                      )}
                      {!portraitCameraOn && (
                        <button
                          type="button"
                          onClick={() => photoFileInputRef.current?.click()}
                          className={secondaryButtonClass}
                        >
                          Subir retrato
                        </button>
                      )}
                      {portraitCameraOn && (
                        <button
                          type="button"
                          onClick={capturePhoto}
                          className="px-3 py-2 text-xs rounded-[20px] border border-[#00b916] bg-[#00b916] hover:bg-[#00a314] text-white font-semibold"
                        >
                          Capturar foto
                        </button>
                      )}
                      {portraitCameraOn && (
                        <button
                          type="button"
                          onClick={stopPortraitCamera}
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
                    <canvas ref={portraitCanvasRef} className="hidden" />
                  </div>
                </div>

                  </>
                ) : null}

                <div className="pt-2">
                  {registrationStep === 1 ? (
                    <button type="submit" className={primaryButtonClass}>
                      Siguiente
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handleFinishRegistration}
                      className={primaryButtonClass}
                    >
                      Continuar
                    </button>
                  )}
                  {registrationStep === 2 ? (
                    <button
                      type="button"
                      onClick={() => {
                        stopLivenessCamera();
                        setRegistrationStep(1);
                        setLivenessError("");
                        setLivenessStatus("");
                      }}
                      className="mt-3 w-full px-8 py-3 rounded-[20px] border border-[#3864d9] bg-white hover:bg-[#ecf2ff] text-[#3864d9] text-base font-bold transition-colors focus:outline-none focus:ring-2 focus:ring-[#3864d9] focus:ring-offset-2 focus:ring-offset-white"
                    >
                      Volver al paso 1
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={goToHomeStart}
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
      const blob = await buildPkpassBlob();
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
          <div className="flex justify-end">
            <button
              type="button"
              onClick={goToHomeStart}
              className="px-4 py-2 text-sm rounded-[20px] border border-[#3c4c69] bg-white hover:bg-[#eef3fb] text-[#3c4c69] font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-[#3c4c69] focus:ring-offset-2"
            >
              Salir
            </button>
          </div>
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
              onClick={handleCompleteRegistration}
              disabled={isSendingConversation}
              className="inline-block min-w-64 px-8 py-3 rounded-[20px] bg-[#0b63ce] hover:bg-[#0a57b3] active:bg-[#084a98] text-white text-base font-bold shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-[#0b63ce] focus:ring-offset-2 focus:ring-offset-white disabled:opacity-70"
            >
              {isSendingConversation ? "Enviando..." : "Registro completado (Enviar a DANA)"}
            </button>

            <button
              type="button"
              onClick={handleDownloadPkpass}
              className="inline-block min-w-64 px-8 py-3 rounded-[20px] bg-[#12a150] hover:bg-[#0f8c46] active:bg-[#0b7439] text-white text-base font-bold shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-[#12a150] focus:ring-offset-2 focus:ring-offset-white"
            >
              Descargar carnet (.pkpass)
            </button>

            {conversationStatus ? (
              <p className="text-xs text-[#0f8c46]">{conversationStatus}</p>
            ) : null}
            {conversationError ? (
              <p className="text-xs text-[#b42318]">{conversationError}</p>
            ) : null}

            <div>
              <button
                type="button"
                onClick={() => {
                  setConversationStatus("");
                  setConversationError("");
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
