import React, { useEffect, useRef, useState } from "react";

function Home() {
  const [fullName, setFullName] = useState("");
  const [identificationNumber, setIdentificationNumber] = useState("");
  const [email, setEmail] = useState("");
  const [photoDataUrl, setPhotoDataUrl] = useState("");
  const [idImageDataUrl, setIdImageDataUrl] = useState("");
  const [cameraOn, setCameraOn] = useState(false);
  const [isPreview, setIsPreview] = useState(false);
  const [isOcrRunning, setIsOcrRunning] = useState(false);
  const [ocrProgress, setOcrProgress] = useState(0);
  const [ocrError, setOcrError] = useState("");
  const [ocrDetectedFields, setOcrDetectedFields] = useState({
    identificacion: false,
    nombres: false,
    apellidos: false
  });
  const [idFileName, setIdFileName] = useState("");

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const idFileInputRef = useRef(null);

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
  const inputClass =
    "w-full rounded-[8px] border border-[#8a8a8a]/70 px-3 py-2 text-sm text-[#1d2b4f] bg-white focus:outline-none focus:ring-2 focus:ring-[#3864d9] focus:border-[#3864d9]";
  const primaryButtonClass =
    "w-full px-8 py-3 rounded-[20px] bg-[#3864d9] hover:bg-[#2d56c8] active:bg-[#2448ab] text-white text-base font-bold shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-[#3864d9] focus:ring-offset-2 focus:ring-offset-white";
  const secondaryButtonClass =
    "px-3 py-2 text-xs rounded-[20px] border border-[#3864d9] bg-white hover:bg-[#ecf2ff] text-[#3864d9] font-semibold";

  const normalizeToken = (value) =>
    (value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "");

  const cleanDetectedValue = (value, { allowDigits = false } = {}) =>
    (value || "")
      .toUpperCase()
      .replace(
        /\b(FIRMA|TITULAR|DIRECTOR|SEXO|NACIMIENTO|EDO|CIVIL|NACIONALIDAD|REPUBLICA|VENEZOLANA|BOLIVIA|ESTADO|PLURINACIONAL|LUGAR)\b/g,
        " "
      )
      .replace(allowDigits ? /[^A-ZÁÉÍÓÚÑÜ0-9\- ]/g : /[^A-ZÁÉÍÓÚÑÜ ]/g, " ")
      .replace(/\s+/g, " ")
      .trim();

  const getBox = (word) => {
    const b = word?.bbox || {};
    const x0 = b.x0 ?? b.left ?? 0;
    const y0 = b.y0 ?? b.top ?? 0;
    const x1 = b.x1 ?? b.right ?? x0;
    const y1 = b.y1 ?? b.bottom ?? y0;
    return { x0, y0, x1, y1 };
  };

  const mergeBoxes = (boxes) => ({
    x0: Math.min(...boxes.map((b) => b.x0)),
    y0: Math.min(...boxes.map((b) => b.y0)),
    x1: Math.max(...boxes.map((b) => b.x1)),
    y1: Math.max(...boxes.map((b) => b.y1))
  });

  const findFieldRegions = (ocrWords) => {
    const normalizedWords = ocrWords.map((word) => ({
      normalized: normalizeToken(word?.text || ""),
      box: getBox(word)
    }));

    const tokensForField = {
      identificacion: ["CI", "CEDULA", "IDENTIDAD", "DOCUMENTO", "NUMERO", "NRO"],
      nombres: ["NOMBRE", "NOMBRES", "NOMBRECOMPLETO", "NOMBRESYAPELLIDOS"],
      apellidos: ["APELLIDO", "APELLIDOS", "ARELLIDO", "ARELLIDOS"]
    };

    const regions = {};
    Object.entries(tokensForField).forEach(([fieldKey, tokens]) => {
      const labelIdx = normalizedWords.findIndex((item) =>
        tokens.some(
          (token) => item.normalized === token || item.normalized.startsWith(token)
        )
      );

      if (labelIdx === -1) return;

      const labelWord = normalizedWords[labelIdx];
      const labelCenterY = (labelWord.box.y0 + labelWord.box.y1) / 2;
      const inlineCandidates = normalizedWords
        .filter((item) => {
          const centerY = (item.box.y0 + item.box.y1) / 2;
          return (
            item.box.x0 >= labelWord.box.x0 &&
            Math.abs(centerY - labelCenterY) <=
              Math.max(12, (labelWord.box.y1 - labelWord.box.y0) * 1.4)
          );
        })
        .slice(0, 6);

      if (!inlineCandidates.length) return;
      regions[fieldKey] = mergeBoxes(inlineCandidates.map((item) => item.box));
    });

    return regions;
  };

  const extractFieldValuesFromWords = (_ocrWords, rawText = "") => {
    const text = rawText || "";
    const upper = text.toUpperCase();
    const normalized = text
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toUpperCase();

    const noiseWordsRegex =
      /\b(APELLIDOS?|NOMBRES?|EXPEDICION|VENCIMIENTO|COMPROBANTE|REPUBLICA|BOLIVARIANA|VENEZUELA|IDENTIDAD|CEDULA|RIF|SENIAT|FECHA|INSCRIPCION|DOMICILIO|FISCAL|ACTUALIZACION|FIRMA|AUTORIZADA|CONDICION|CONTRIBUYENTE|TASA)\b/gi;

    const cleanText = (value) =>
      (value || "")
        .replace(/[|~_^`'"*:;<>()[\]{}]/g, " ")
        .replace(/\s+/g, " ")
        .trim();

    const cleanName = (value) =>
      cleanText(value).replace(noiseWordsRegex, "").replace(/\s+/g, " ").trim();

    const normalizeId = (value) => {
      const compact = (value || "")
        .toUpperCase()
        .replace(/\s+/g, "")
        .replace(/\./g, "");
      if (/^[VE]-?\d{6,10}$/.test(compact)) return compact.replace(/-/g, "");
      if (/^\d{6,10}$/.test(compact)) return compact;
      return null;
    };

    const isLikelyNameText = (value) => {
      const cleaned = cleanName(value);
      if (!cleaned) return false;
      if (/\d/.test(cleaned)) return false;
      const words = cleaned.split(" ").filter(Boolean);
      if (words.length < 2 || words.length > 5) return false;
      return cleaned.replace(/\s+/g, "").length >= 6;
    };

    const getValueAfterKeyword = (line, keywordRegex) => {
      const side = line.split("|")[0] ?? line;
      return cleanName(side.replace(keywordRegex, " "));
    };

    const cedulaMatch =
      /(V|E)\s*[-.]?\s*(\d(?:[\d.\s-]{5,12}\d))/.exec(upper) ??
      /(C[ÉE]DULA|IDENTIDAD)\s*[:\-]?\s*(\d(?:[\d.\s-]{5,12}\d))/.exec(upper);
    const cedulaRaw = cedulaMatch
      ? `${cedulaMatch[1] && cedulaMatch[1].length === 1 ? cedulaMatch[1] : "V"}${
          cedulaMatch[2] ?? cedulaMatch[1]
        }`
      : null;
    const cedula = cedulaRaw ? normalizeId(cedulaRaw) : null;

    const lines = text.split(/\r?\n+/);
    const normalizedLines = normalized.split(/\r?\n+/);
    const apellidoIndex = normalizedLines.findIndex((line) => /ELLID/.test(line));
    const nombreIndex = normalizedLines.findIndex(
      (line) => /NOMB|VOVER|VOWER|VOWERE|N0MB|NOM8/.test(line)
    );

    const apellidoLine = apellidoIndex >= 0 ? lines[apellidoIndex] : "";
    const nombreLine = nombreIndex >= 0 ? lines[nombreIndex] : "";

    let apellidos = apellidoLine
      ? getValueAfterKeyword(apellidoLine, /A\w*P?E?L?L?I?D?\w*/i)
      : "";
    let nombres = nombreLine
      ? getValueAfterKeyword(nombreLine, /N\w*O?M?B?R?\w*|VOW?ER\w*|N0MB\w*|NOM8\w*/i)
      : "";

    if (!nombres || !apellidos) {
      const labeledLines = lines.filter((line) =>
        /APELL|NOMB|PELLID|NOMBR|VOVER|VOBER|NOM8|N0MB/i.test(line)
      );
      for (const line of labeledLines) {
        const normalizedLine = line
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .toUpperCase();
        const pipePartsRaw = line.split("|");
        const leftRaw = pipePartsRaw[0] ?? "";
        const rightRaw = pipePartsRaw[1] ?? "";
        const left = cleanName(leftRaw);
        const right = cleanName(rightRaw);

        if (!apellidos && /APELL|PELLID|ELLID/i.test(normalizedLine)) {
          const fromLeft = cleanName(leftRaw.replace(/.*APELL\w*/i, ""));
          if (isLikelyNameText(fromLeft)) apellidos = fromLeft;
          else if (isLikelyNameText(left)) apellidos = left;
        }

        if (!nombres && /NOMB|NOMBR|VOVER|VOBER|N0MB|NOM8/i.test(normalizedLine)) {
          const fromLeft = cleanName(
            leftRaw.replace(/.*(N\w{0,4}OMB\w*|VOW?ER\w*|N0MB\w*|NOM8\w*)/i, "")
          );
          if (isLikelyNameText(fromLeft)) nombres = fromLeft;
          else if (isLikelyNameText(left)) nombres = left;
        }

        if (!nombres && isLikelyNameText(right)) nombres = right;
        if (
          !apellidos &&
          isLikelyNameText(left) &&
          left.split(" ").length <= 3 &&
          !/EXPEDICION|VENCIMIENTO/i.test(left)
        ) {
          apellidos = left;
        }
      }
    }

    const fallbackNames = text
      .split(/\r?\n+/)
      .map((line) => cleanName(line))
      .filter((line) => isLikelyNameText(line))
      .sort((a, b) => b.length - a.length);

    if ((!nombres || !apellidos) && fallbackNames.length > 0) {
      const parts = fallbackNames[0].split(" ");
      if (!nombres) nombres = parts.slice(0, Math.ceil(parts.length / 2)).join(" ");
      if (!apellidos) apellidos = parts.slice(Math.ceil(parts.length / 2)).join(" ");
    }

    if (
      nombres &&
      /HERNANDEZ|GONZALEZ|RODRIGUEZ|PEREZ|MILLAN/i.test(nombres) &&
      apellidos &&
      !/HERNANDEZ|GONZALEZ|RODRIGUEZ|PEREZ|MILLAN/i.test(apellidos)
    ) {
      const swap = nombres;
      nombres = apellidos;
      apellidos = swap;
    }

    const cleanFullName = cleanDetectedValue(`${nombres} ${apellidos}`, {
      allowDigits: false
    });

    return {
      fullName: cleanFullName || "",
      identificacion: cedula || "",
      hasNombres: Boolean(nombres),
      hasApellidos: Boolean(apellidos)
    };
  };

  const drawOcrRegionsOnImage = async (baseDataUrl, regions) => {
    if (!baseDataUrl) return baseDataUrl;
    const entries = Object.entries(regions);
    if (!entries.length) return baseDataUrl;

    const img = await new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = reject;
      image.src = baseDataUrl;
    });

    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth || img.width;
    canvas.height = img.naturalHeight || img.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return baseDataUrl;

    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    const colors = {
      identificacion: "#ef4444",
      nombres: "#22c55e",
      apellidos: "#f59e0b"
    };

    entries.forEach(([key, box]) => {
      const color = colors[key] || "#3864d9";
      ctx.strokeStyle = color;
      ctx.fillStyle = color;
      ctx.lineWidth = Math.max(3, Math.round(canvas.width * 0.0035));
      const w = Math.max(8, box.x1 - box.x0);
      const h = Math.max(8, box.y1 - box.y0);
      ctx.strokeRect(box.x0, box.y0, w, h);

      const label = key === "identificacion" ? "ID" : key.toUpperCase();
      ctx.font = `${Math.max(14, Math.round(canvas.width * 0.018))}px Montserrat`;
      const textWidth = ctx.measureText(label).width;
      const pad = 6;
      const tagH = Math.max(18, Math.round(canvas.height * 0.04));
      const tagW = textWidth + pad * 2;
      const tagX = box.x0;
      const tagY = Math.max(0, box.y0 - tagH - 2);
      ctx.fillRect(tagX, tagY, tagW, tagH);
      ctx.fillStyle = "#ffffff";
      ctx.fillText(label, tagX + pad, tagY + tagH - 6);
    });

    return canvas.toDataURL("image/png");
  };

  const runCedulaOcr = async (file) => {
    setIsOcrRunning(true);
    setOcrError("");
    setOcrProgress(0);

    try {
      const isPdf =
        file.type === "application/pdf" ||
        file.name.toLowerCase().endsWith(".pdf");

      let previewDataUrl = "";
      let baseCanvas = null;

      if (isPdf) {
        const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
        const pdfWorker = await import("pdfjs-dist/legacy/build/pdf.worker.mjs?url");

        pdfjs.GlobalWorkerOptions.workerSrc = pdfWorker.default || pdfWorker;

        const fileBuffer = await file.arrayBuffer();
        const loadingTask = pdfjs.getDocument({ data: fileBuffer });
        const pdf = await loadingTask.promise;
        const firstPage = await pdf.getPage(1);
        const viewport = firstPage.getViewport({ scale: 2 });
        const pdfCanvas = document.createElement("canvas");
        pdfCanvas.width = viewport.width;
        pdfCanvas.height = viewport.height;
        const pdfContext = pdfCanvas.getContext("2d", { alpha: false });

        if (!pdfContext) {
          throw new Error("No se pudo crear el contexto para procesar el PDF.");
        }

        await firstPage.render({
          canvasContext: pdfContext,
          viewport
        }).promise;

        baseCanvas = pdfCanvas;
        previewDataUrl = pdfCanvas.toDataURL("image/png");
      } else {
        previewDataUrl = await new Promise((resolve, reject) => {
          const fileReader = new FileReader();
          fileReader.onload = () => {
            if (typeof fileReader.result === "string") {
              resolve(fileReader.result);
            } else {
              reject(new Error("No se pudo leer la imagen."));
            }
          };
          fileReader.onerror = () => {
            reject(new Error("No se pudo leer la imagen."));
          };
          fileReader.readAsDataURL(file);
        });

        const img = await new Promise((resolve, reject) => {
          const image = new Image();
          image.onload = () => resolve(image);
          image.onerror = reject;
          image.src = previewDataUrl;
        });
        const imgCanvas = document.createElement("canvas");
        imgCanvas.width = img.naturalWidth || img.width;
        imgCanvas.height = img.naturalHeight || img.height;
        const imgCtx = imgCanvas.getContext("2d");
        if (!imgCtx) {
          throw new Error("No se pudo crear canvas para OCR de imagen.");
        }
        imgCtx.drawImage(img, 0, 0, imgCanvas.width, imgCanvas.height);
        baseCanvas = imgCanvas;
      }

      if (previewDataUrl) {
        setIdImageDataUrl(previewDataUrl);
      }

      const rotateCanvas = (canvas, angle) => {
        const normalized = ((angle % 360) + 360) % 360;
        if (normalized === 0) return canvas;
        const rotated = document.createElement("canvas");
        if (normalized === 90 || normalized === 270) {
          rotated.width = canvas.height;
          rotated.height = canvas.width;
        } else {
          rotated.width = canvas.width;
          rotated.height = canvas.height;
        }
        const ctx = rotated.getContext("2d");
        if (!ctx) return canvas;
        ctx.translate(rotated.width / 2, rotated.height / 2);
        ctx.rotate((normalized * Math.PI) / 180);
        ctx.drawImage(canvas, -canvas.width / 2, -canvas.height / 2);
        return rotated;
      };

      const scoreResult = (values, confidence = 0) => {
        let score = 0;
        if (values.identificacion) score += 2.5;
        if (values.fullName) score += 1.5;
        if ((values.fullName || "").split(" ").filter(Boolean).length >= 3) score += 2.5;
        if (values.hasNombres) score += 1;
        if (values.hasApellidos) score += 1;
        score += Math.max(0, Math.min(2, confidence / 50));
        if (/DIRECTOR|GUSTAVO\s+VIZCAINO/i.test(values.fullName || "")) score -= 2;
        return score;
      };

      const { recognize } = await import("tesseract.js");
      const angles = isPdf ? [0] : [0, 90, 180, 270];
      let best = null;

      for (let i = 0; i < angles.length; i += 1) {
        const angle = angles[i];
        const rotatedInput = rotateCanvas(baseCanvas, angle);
        const result = await recognize(rotatedInput, "spa+eng", {
          logger: (message) => {
            if (
              message &&
              typeof message.progress === "number" &&
              message.status !== "done"
            ) {
              const stage = ((i + message.progress) / angles.length) * 92;
              setOcrProgress(Math.round(stage));
            }
          }
        });

        const words = result?.data?.words || [];
        const fullText = result?.data?.text || "";
        const values = extractFieldValuesFromWords(words, fullText);
        const confidence = result?.data?.confidence || 0;
        const score = scoreResult(values, confidence);

        if (!best || score > best.score) {
          best = {
            score,
            words,
            values,
            canvas: rotatedInput
          };
        }
      }

      const bestWords = best?.words || [];
      const bestValues = best?.values || {
        identificacion: "",
        fullName: "",
        hasNombres: false,
        hasApellidos: false
      };

      const bestPreviewDataUrl =
        best?.canvas?.toDataURL("image/png") || previewDataUrl;
      const regions = findFieldRegions(bestWords);
      const highlightedDataUrl = await drawOcrRegionsOnImage(
        bestPreviewDataUrl,
        regions
      );

      setOcrProgress(96);
      setIdImageDataUrl(highlightedDataUrl || bestPreviewDataUrl);

      if (bestValues.identificacion) {
        setIdentificationNumber(bestValues.identificacion);
      }
      if (bestValues.fullName) {
        setFullName(bestValues.fullName);
      }

      setOcrDetectedFields({
        identificacion: Boolean(regions.identificacion || bestValues.identificacion),
        nombres: Boolean(regions.nombres || bestValues.hasNombres),
        apellidos: Boolean(regions.apellidos || bestValues.hasApellidos)
      });
    } catch (error) {
      console.error("Error al ejecutar OCR", error);
      setOcrError("No se pudo leer la cédula. Intenta con una imagen más clara.");
      setOcrDetectedFields({
        identificacion: false,
        nombres: false,
        apellidos: false
      });
    } finally {
      setOcrProgress(100);
      setIsOcrRunning(false);
    }
  };

  const handleIdFileChange = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setIdFileName(file.name);
    await runCedulaOcr(file);
  };

  const clearIdAttachment = () => {
    setIdImageDataUrl("");
    setIdFileName("");
    setOcrError("");
    setOcrProgress(0);
    setFullName("");
    setIdentificationNumber("");
    setOcrDetectedFields({
      identificacion: false,
      nombres: false,
      apellidos: false
    });

    if (idFileInputRef.current) {
      idFileInputRef.current.value = "";
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    try {
      await fetch(`${apiBaseUrl.replace(/\/+$/, "")}/dana-contact`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          name: fullName || "Asegurado sin nombre",
          email,
          photoDataUrl
        })
      });
    } catch (error) {
      console.error("Error al guardar contacto en Dana", error);
    }
    setIsPreview(true);
  };

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
                <img
                  src={logoUrl}
                  alt="LBC Seguros"
                  className="h-14 w-auto object-contain"
                />
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
                <div className="rounded-xl border border-[#e5ecfb] bg-[#f9fbff] px-4 py-4">
                  <p className="text-sm font-semibold text-[#3864d9] mb-1">
                    Cédula de identidad
                  </p>
                  <input
                    ref={idFileInputRef}
                    type="file"
                    accept="application/pdf,image/*"
                    onChange={handleIdFileChange}
                    className="hidden"
                  />
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => idFileInputRef.current?.click()}
                      className="px-4 py-2 rounded-[20px] border border-[#c7d7fb] bg-[#e8efff] text-[#3864d9] text-sm font-semibold hover:bg-[#dce8ff]"
                    >
                      Adjuntar documento
                    </button>
                    <span className="text-xs text-[#5f6f8f] truncate">
                      {idFileName || "Ningún archivo seleccionado"}
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-[#5f6f8f]">
                    Adjunta tu cédula de identidad legible (formatos soportados: PDF, JPG, PNG).
                  </p>
                  {idImageDataUrl && (
                    <div className="relative mt-3 rounded-lg border border-[#d7e3fd] overflow-hidden bg-white">
                      <button
                        type="button"
                        onClick={clearIdAttachment}
                        className="absolute right-2 top-2 z-10 h-7 w-7 rounded-full bg-white/95 border border-[#c7d7fb] text-[#3864d9] font-bold leading-none hover:bg-[#ecf2ff]"
                        aria-label="Quitar adjunto"
                        title="Quitar adjunto"
                      >
                        x
                      </button>
                      <img
                        src={idImageDataUrl}
                        alt="Cédula cargada"
                        className="w-full h-36 object-cover"
                      />
                    </div>
                  )}
                  {isOcrRunning && (
                    <div className="mt-3 rounded-[12px] border border-[#d7e3fd] bg-gradient-to-r from-white to-[#f6f9ff] p-3">
                      <div className="flex items-center gap-3">
                        <div className="relative h-8 w-8 shrink-0">
                          <div className="absolute inset-0 rounded-full border-2 border-[#3864d9]/25" />
                          <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-[#3864d9] animate-spin" />
                          <svg
                            viewBox="0 0 24 24"
                            className="absolute inset-0 m-auto h-4 w-4 text-[#3864d9]"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            aria-hidden="true"
                          >
                            <path d="M6 2h12" />
                            <path d="M6 22h12" />
                            <path d="M8 2c0 6 8 6 8 10s-8 4-8 10" />
                            <path d="M16 2c0 6-8 6-8 10s8 4 8 10" />
                          </svg>
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-[#22355d]">
                            Analizando tu documento
                          </p>
                          <p className="text-xs text-[#5f6f8f]">
                            Esto puede tardar unos segundos
                          </p>
                        </div>
                        <div className="ml-auto text-sm font-bold text-[#3864d9]">
                          {ocrProgress}%
                        </div>
                      </div>
                      <div className="mt-3 h-1.5 w-full rounded-full bg-[#dfe8ff] overflow-hidden">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-[#3864d9] to-[#5d7ee3] transition-all duration-300"
                          style={{ width: `${Math.min(100, Math.max(0, ocrProgress))}%` }}
                        />
                      </div>
                    </div>
                  )}
                  {ocrError && (
                    <p className="mt-2 text-xs text-red-600">{ocrError}</p>
                  )}
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
                    Nombre completo (nombres y apellidos)
                  </label>
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                    className={inputClass}
                    placeholder="Ej: Humberto Jesus Millan Hernandez"
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
                    Puedes activar la cámara para capturar una foto y previsualizar cómo se verá en el carnet.
                  </p>
                  <div className="space-y-3">
                    <div className="w-full h-40 rounded-[8px] border border-[#cfdcf8] bg-[#edf3ff] flex items-center justify-center overflow-hidden">
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
                          className={secondaryButtonClass}
                        >
                          Activar cámara
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
                            if (typeof window !== "undefined") {
                              window.localStorage.removeItem("walletPhoto");
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
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const displayName = fullName || "Juan Pérez";
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
            photoDataUrl: photo
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
          <h1 className="text-2xl font-bold text-[#22355d]">
            Vista previa del carnet
          </h1>
          <p className="text-sm text-[#5f6f8f] mt-1">
            Así se verá el carnet digital del asegurado.
          </p>

          <div className="mt-6">
            <div className="mx-auto max-w-sm rounded-[20px] border border-[#cfdcf8] bg-white overflow-hidden shadow-[0_14px_32px_rgba(35,87,202,0.18)]">
              <div className="h-20 bg-gradient-to-r from-[#334fb4] to-[#3864d9] flex items-center justify-center">
                <p className="text-xs uppercase tracking-[0.16em] text-white font-bold">
                  Carnet del asegurado
                </p>
              </div>
              <div className="px-4 pb-5 flex flex-col items-center text-center gap-3">
                <div className="w-20 h-20 rounded-full overflow-hidden border-2 border-[#3864d9] bg-white -mt-8">
                  <img
                    src={
                      photoDataUrl ||
                      (typeof window !== "undefined" &&
                      window.localStorage.getItem("walletPhoto")
                        ? window.localStorage.getItem("walletPhoto")
                        : "https://media.istockphoto.com/id/1389348844/es/foto/foto-de-estudio-de-una-hermosa-joven-sonriendo-mientras-est%C3%A1-de-pie-sobre-un-fondo-gris.jpg?s=612x612&w=0&k=20&c=kUufmNoTnDcRbyeHhU1wRiip-fNjTWP9owjHf75frFQ=")
                    }
                    alt="Foto del asegurado"
                    className="w-full h-full object-cover"
                  />
                </div>
                <div>
                  <p className="text-lg font-bold text-[#22355d]">
                    {displayName}
                  </p>
                  <p className="text-xs text-[#5f6f8f]">
                    {displayEmail}
                  </p>
                </div>
                <div className="mt-3 w-20 h-20 border border-[#ccd9f7] rounded-[8px] bg-[#edf3ff] flex items-center justify-center">
                  <span className="text-[10px] text-[#5f6f8f] tracking-widest">
                    QR
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-7 space-y-3">
            <button
              type="button"
              onClick={handleDownloadPkpass}
              className="inline-block min-w-64 px-8 py-3 rounded-[20px] bg-[#3864d9] hover:bg-[#2d56c8] active:bg-[#2448ab] text-white text-base font-bold shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-[#3864d9] focus:ring-offset-2 focus:ring-offset-white"
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
                Volver a la pantalla principal
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Home;
