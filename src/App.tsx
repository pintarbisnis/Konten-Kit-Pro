/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  Upload, 
  ImageIcon, 
  Sparkles, 
  Download, 
  RefreshCw, 
  Trash2, 
  Camera, 
  Package, 
  ArrowRight, 
  ArrowLeft,
  Video, 
  Mic, 
  Hand, 
  Shirt, 
  Smartphone, 
  ChevronLeft,
  Settings,
  Layout,
  Layers,
  CheckCircle2,
  Monitor,
  Maximize2,
  Loader2,
  Aperture,
  Sliders,
  X,
  Plus,
  ChevronDown,
  ChevronUp,
  ZoomIn,
  Eye,
  Copy,
  FileText,
  Edit3,
  Volume2,
  Wand2,
  PlayCircle,
  Footprints,
  Watch,
  Pocket,
  UserCheck
} from 'lucide-react';
import { GoogleGenAI, Type, Modality } from "@google/genai";
import JSZip from 'jszip';
import { motion, AnimatePresence } from "motion/react";
import { 
  fetchWithRetry, 
  playClick, 
  playStartupSound,
  safeCopyToClipboard, 
  processImageForDownload, 
  resizeImage,
  base64ToWavUrl 
} from './utils';
import { 
  GENERATIVE_MODEL, 
  TEXT_MODEL, 
  TTS_MODEL, 
  VIDEO_MODEL,
  MODE_BACKGROUNDS, 
  VOICES, 
  TONES, 
  MODES, 
  RATIOS, 
  SCENE_COUNTS,
  CHAR_HAIR_OPTIONS,
  CHAR_OUTFIT_OPTIONS,
  CHAR_AGE_OPTIONS,
  CHAR_ETHNICITY_OPTIONS,
  CHAR_BODY_OPTIONS,
  CHAR_EYE_OPTIONS,
  CHAR_EXPRESSION_OPTIONS,
  CHAR_FACE_DETAIL_OPTIONS
} from './constants';
import { REALISM_LAWS, IDENTITY_LOCK, PRODUCT_CONSISTENCY, getModeLogic } from './logic';
import { 
  GeneratingState, 
  LayoutWrapper, 
  Navbar, 
  SectionTitle, 
  UploadZone, 
  ButtonCTA,
  CooldownBadge,
  DraggableBackButton
} from './components/UI';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

// Utility to sleep
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Helper to execute API calls with retry for 429
async function executeWithRetry(apiCall: () => Promise<any>, maxRetries = 3) {
  let lastError: any;
  for (let i = 0; i <= maxRetries; i++) {
    try {
      return await apiCall();
    } catch (err: any) {
      lastError = err;
      const isRateLimit = err?.message?.includes('429') || 
                          err?.status === 429 || 
                          JSON.stringify(err).includes('429') ||
                          JSON.stringify(err).includes('RESOURCE_EXHAUSTED');
      
      if (isRateLimit && i < maxRetries) {
        const delay = (i + 1) * 3000; // 3s, 6s, 9s
        console.warn(`Rate limit hit (429). Retrying in ${delay/1000}s...`);
        await sleep(delay);
        continue;
      }
      throw err;
    }
  }
}

export default function App() {
  const [view, setView] = useState('welcome');
  const [selectedMode, setSelectedMode] = useState<any>(null);
  
  // Data State
  const [modelImage, setModelImage] = useState<string | null>(null);
  const [guestModelImage, setGuestModelImage] = useState<string | null>(null);
  const [productImage, setProductImage] = useState<string | null>(null);
  const [productName, setProductName] = useState("");
  const [productDesc, setProductDesc] = useState("");
  const [dynamicBackgrounds, setDynamicBackgrounds] = useState<string[]>(MODE_BACKGROUNDS.ugc);

  // Character Customize State
  const [charIdentity, setCharIdentity] = useState('exact'); // 'exact' or 'inspired'
  const [charGender, setCharGender] = useState('Female');
  const [charHair, setCharHair] = useState(CHAR_HAIR_OPTIONS[0]);
  const [charOutfit, setCharOutfit] = useState(CHAR_OUTFIT_OPTIONS[0]);
  const [charAge, setCharAge] = useState(CHAR_AGE_OPTIONS[0]);
  const [charEthnicity, setCharEthnicity] = useState(CHAR_ETHNICITY_OPTIONS[0]);
  const [charBody, setCharBody] = useState(CHAR_BODY_OPTIONS[0]);
  const [charEyes, setCharEyes] = useState(CHAR_EYE_OPTIONS[0]);
  const [charExpression, setCharExpression] = useState(CHAR_EXPRESSION_OPTIONS[0]);
  const [charFaceDetails, setCharFaceDetails] = useState(CHAR_FACE_DETAIL_OPTIONS[0]);

  // Custom Background State
  const [bgType, setBgType] = useState('preset'); 
  const [customBg, setCustomBg] = useState("");

  // flow State
  const [isAnalyzingProduct, setIsAnalyzingProduct] = useState(false);
  const [isProductConfirmed, setIsProductConfirmed] = useState(false);

  const getThemeInputClass = () => {
    return "bg-[#061810] border border-emerald-500/30 text-emerald-50 placeholder:text-emerald-400/40 shadow-lg relative z-10 opacity-100 focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400/30 transition-all";
  };

  const themeInputClass = getThemeInputClass();

  const [config, setConfig] = useState({
    background: MODE_BACKGROUNDS.ugc[0],
    ratio: '9:16',
    scenes: 1,
    ugcStyle: 'Handheld',
    campaignPrompt: ""
  });

  // Generation State
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedImages, setGeneratedImages] = useState<any[]>([]);
  const [sceneLoadings, setSceneLoadings] = useState<Record<number, boolean>>({});
  const [videoLoadings, setVideoLoadings] = useState<Record<number, boolean>>({});
  const [audioLoadings, setAudioLoadings] = useState<Record<number, boolean>>({});
  const [scenePrompts, setScenePrompts] = useState<Record<number, string>>({});
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [copiedStates, setCopiedStates] = useState<Record<number, boolean>>({});

  // Audio Maker State
  const [showVideoGenerators, setShowVideoGenerators] = useState(false);
  const [isAudioStudioOpen, setIsAudioStudioOpen] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [isAudioStudioMinimized, setIsAudioStudioMinimized] = useState(false);

  useEffect(() => {
    if (cooldown > 0) {
      const timer = setTimeout(() => setCooldown(cooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [cooldown]);

  const [globalError, setGlobalError] = useState<string | null>(null);

  const [voScript, setVoScript] = useState("");
  const [voDuration, setVoDuration] = useState("15s");
  const [voVoice, setVoVoice] = useState(VOICES[0].id);
  const [voTone, setVoTone] = useState(TONES[1]);
  const [voAudioUrl, setVoAudioUrl] = useState<string | null>(null);
  const [isGeneratingVOScript, setIsGeneratingVOScript] = useState(false);
  const [isGeneratingVOAudio, setIsGeneratingVOAudio] = useState(false);


  const modelInputRef = useRef<HTMLInputElement>(null);
  const guestModelInputRef = useRef<HTMLInputElement>(null);
  const productInputRef = useRef<HTMLInputElement>(null);

  const handleResetAndNew = () => {
    playClick();
    setSelectedMode(null);
    setModelImage(null);
    setGuestModelImage(null);
    setProductImage(null);
    setProductName("");
    setProductDesc("");
    setCharIdentity('exact');
    setCharHair('');
    setCharOutfit('');
    setCharAge('');
    setCharEthnicity('');
    setCharBody('');
    setCharEyes('');
    setCharExpression('');
    setCharFaceDetails('');
    setIsProductConfirmed(false);
    setBgType('preset');
    setCustomBg("");
    setConfig({
      background: MODE_BACKGROUNDS.ugc[0],
      ratio: '9:16',
      scenes: 1,
      ugcStyle: 'Handheld',
      campaignPrompt: ""
    });
    setGeneratedImages([]);
    setSceneLoadings({});
    setVideoLoadings({});
    setAudioLoadings({});
    setScenePrompts({});
    setPreviewImage(null);
    setCopiedStates({});
    setVoScript("");
    setVoAudioUrl(null);
    setGlobalError(null);
    setIsAudioStudioOpen(false);
    setIsAudioStudioMinimized(false);
    setView('mode-selection');
  };

  const updateSceneData = (index: number, updates: any) => {
    setGeneratedImages(prev => {
        const newArr = [...prev];
        if (newArr[index]) {
            newArr[index] = { ...newArr[index], ...updates };
        }
        return newArr;
    });
  };

  const handleCopyPrompt = (index: number) => {
    playClick();
    const sceneData = generatedImages[index];
    if (!sceneData) return;

    let contextLogic = "";
    if (sceneData.voActive) {
        if (sceneData.isBRoll) {
            contextLogic = `NARRATIVE VOICE-OVER: '${sceneData.voText}'. Product remains the main focus.`;
        } else {
            contextLogic = `LIP-SYNC: Model is speaking, mouth moving precisely to dialogue: '${sceneData.voText}'.`;
        }
    } else {
        contextLogic = sceneData.isBRoll ? "AMBIENT: No human visible, purely product focused." : "AMBIENT: Mouth closed or natural breathing, no talking.";
    }

    const dynamicPrompt = `PROMPT: ${sceneData.videoMotion} CAMERA: ${sceneData.videoCamera} DETAILS: Photorealistic high-fidelity video generation. Maintain strict consistency with the provided image reference. CONTEXT: ${contextLogic} ENVIRONMENT: ${sceneData.activeBackground}. NEGATIVE: distortion, morphing, bad hands, text overlays.`;

    safeCopyToClipboard(dynamicPrompt);
    setCopiedStates(prev => ({ ...prev, [index]: true }));
    setTimeout(() => {
        setCopiedStates(prev => ({ ...prev, [index]: false }));
    }, 2000);
  };

  const analyzeProductImage = async (originalBase64: string) => {
    setIsAnalyzingProduct(true);
    setProductName("");
    setProductDesc("");
    try {
        // High Speed Optimization: Resize image before analysis
        const resizedBase64 = await resizeImage(originalBase64, 512, 512);
        const imageBase64 = resizedBase64.split(',')[1];
        
        const analyzeAi = new GoogleGenAI({ apiKey: process.env.API_KEY || process.env.GEMINI_API_KEY || "" });

        const modeTitle = selectedMode?.title || 'Komersial';
        const systemPrompt = `
        Tugas Anda adalah menganalisis gambar produk dan mengembalikan HANYA format JSON valid.
        1. "productName": Identifikasi produk, maksimal 3 kata (Bahasa Indonesia).
        2. "productDesc": Deskripsi SANGAT RINGKAS (kategori, merek, warna/ciri menonjol, dan estimasi ukuran fisik produk tersebut jika dibandingkan dengan tangan manusia).
        3. "backgrounds": Array berisi 7 rekomendasi latar/background yang eksklusif & estetik untuk sesi ${modeTitle} produk tersebut di Indonesia.
        `;

        const response = await analyzeAi.models.generateContent({
            model: TEXT_MODEL,
            contents: [{
                parts: [
                    { text: systemPrompt },
                    { inlineData: { mimeType: "image/png", data: imageBase64 } }
                ]
            }],
            config: { 
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        productName: { type: Type.STRING },
                        productDesc: { type: Type.STRING },
                        backgrounds: { type: Type.ARRAY, items: { type: Type.STRING } }
                    },
                    required: ["productName", "productDesc", "backgrounds"]
                }
            }
        });

        const text = response.text;
        if (text) {
            const data = JSON.parse(text);
            setProductName(data.productName || "Produk Terdeteksi");
            setProductDesc(data.productDesc || "Detail produk.");
            const baseBgs = selectedMode ? (MODE_BACKGROUNDS as any)[selectedMode.id] : MODE_BACKGROUNDS.ugc;
            if (data.backgrounds && Array.isArray(data.backgrounds) && data.backgrounds.length > 0) {
                const mergedBackgrounds = Array.from(new Set([...data.backgrounds, ...baseBgs])) as string[];
                setDynamicBackgrounds(mergedBackgrounds);
                setConfig(prev => ({...prev, background: data.backgrounds[0] || mergedBackgrounds[0]}));
                setBgType('preset');
            } else {
                setDynamicBackgrounds(baseBgs);
                setConfig(prev => ({...prev, background: baseBgs[0]}));
            }
        }
    } catch (error: any) {
        console.error("Product analysis error:", error);
        setGlobalError("AI gagal mengenali produk Anda. Jangan khawatir, Anda bisa isi detailnya secara manual.");
        setProductName("Produk Manual");
        setProductDesc("Gagal memuat AI. Silakan isi manual.");
        const baseBgs = selectedMode ? (MODE_BACKGROUNDS as any)[selectedMode.id] : MODE_BACKGROUNDS.ugc;
        setDynamicBackgrounds(baseBgs);
        setConfig(prev => ({...prev, background: baseBgs[0]}));
    } finally {
        setIsAnalyzingProduct(false);
    }
  };

  const handleProductUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    playClick();
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result as string;
        setProductImage(base64);
        setIsProductConfirmed(false);
        analyzeProductImage(base64);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleModelUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    playClick();
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setModelImage(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleGuestModelUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    playClick();
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setGuestModelImage(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const generateScripts = async () => {
      let toneInstruction = "Gaya bahasa yang natural, santai, dan menarik.";
      let narrativeArc = "Alur cerita yang mengalir secara natural dari awal sampai akhir.";

      if (selectedMode?.id === 'ugc') {
          toneInstruction = "Gaya bahasa UGC: Santai, jujur, seperti testimoni pribadi, tidak kaku, bahasa gaul yang sopan.";
          narrativeArc = `SEMUA SCENE WAJIB BERGAYA UGC (Model berbicara langsung ke kamera). Fokus pada ekspresi wajah dan interaksi langsung dengan penonton.`;
      }

      const prompt = `Generate a JSON object with a single key 'scenes' containing an array of precisely ${config.scenes} objects for a storyboard about ${productName} (${productDesc}). ${config.campaignPrompt ? `Context: ${config.campaignPrompt}.` : ""} ${narrativeArc} 
      IMPORTANT: Use Bahasa Indonesia for the 'script' field. ${toneInstruction} 

      Each scene object MUST have:
      1. 'script': The spoken narration (short and engaging).
      2. 'visual_description': A natural visual description for a smartphone photo. Focus on candid poses and realistic environments.
      3. 'camera_angle': Camera angle (e.g., 'Close-up', 'Medium shot').
      4. 'motion': Video motion (e.g., 'Slow zoom', 'Pan').`;

      try {
          const scriptsAi = new GoogleGenAI({ apiKey: process.env.API_KEY || process.env.GEMINI_API_KEY || "" });
          const response = await executeWithRetry(() => scriptsAi.models.generateContent({
            model: TEXT_MODEL,
            contents: [{ parts: [{ text: prompt }] }],
            config: { 
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        scenes: { 
                            type: Type.ARRAY, 
                            items: { 
                                type: Type.OBJECT,
                                properties: {
                                    script: { type: Type.STRING },
                                    visual_description: { type: Type.STRING },
                                    camera_angle: { type: Type.STRING },
                                    motion: { type: Type.STRING }
                                },
                                required: ["script", "visual_description", "camera_angle", "motion"]
                            } 
                        }
                    },
                    required: ["scenes"]
                }
            }
          }));
          const text = response.text;
          if (text) {
              const data = JSON.parse(text);
              if (data.scenes && data.scenes.length > 0) {
                  return data.scenes;
              }
          }
      } catch (err: any) {
          console.error("Script gen error", err);
          setGlobalError("Gagal membuat naskah otomatis. Kami akan gunakan naskah standar untuk sementara.");
      }
      return Array.from({ length: config.scenes }).map((_, i) => ({
          script: `Scene ${i+1}: Narasi default untuk ${productName}.`,
          visual_description: `Showing ${productName} in a professional setting.`,
          camera_angle: "Medium shot",
          motion: "Slow cinematic pan"
      }));
  };

  const generateVisual = async () => {
    playClick(); 
    setIsGenerating(true);
    setGlobalError(null);
    setGeneratedImages(new Array(config.scenes).fill(null)); 
    setSceneLoadings({});
    setScenePrompts({});
    setCopiedStates({});
    setView('result');

    try {
      const activeBackground = bgType === 'custom' ? (customBg || 'Studio Foto Polos') : config.background;
      const scenesData = await generateScripts();
      const imageAi = new GoogleGenAI({ apiKey: process.env.API_KEY || process.env.GEMINI_API_KEY || "" });

      // HIGH SPEED OPTIMIZATION: Resize references once before parallel batch
      const resizedModel = modelImage ? await resizeImage(modelImage, 768, 768) : null;
      const resizedProduct = productImage ? await resizeImage(productImage, 768, 768) : null;
      
      const base64Model = resizedModel ? resizedModel.split(',')[1] : null;
      const base64ProductRaw = resizedProduct ? resizedProduct.split(',')[1] : null;

      // STABILITY OPTIMIZATION: Sequential processing one by one to strictly avoid 429 Rate Limit errors
      for (let i = 0; i < config.scenes; i++) {
        // Add a safety pause between images to prevent rate limiting
        if (i > 0) await sleep(2500);

        try {
          const sceneInfo = scenesData[i] || { script: `Scene ${i+1}`, visual_description: "", camera_angle: "", motion: "" };
          const scriptText = sceneInfo.script;
          const isBRoll = (i % 3 === 2) && (i !== config.scenes - 1) && (selectedMode?.id !== 'ugc');
          
          let role = isBRoll ? "B-ROLL DETAIL" : `ACT ${i + 1}`;
          if (i === 0) role = "HOOK";
          if (i === config.scenes - 1) role = "CTA";

          const modeParams = getModeLogic(
            selectedMode?.id, 
            i, 
            productName, 
            productDesc, 
            activeBackground, 
            config.ugcStyle,
            {
                identity: charIdentity,
                gender: charGender,
                hair: charHair,
                outfit: charOutfit,
                age: charAge,
                ethnicity: charEthnicity,
                body: charBody,
                eyes: charEyes,
                expression: charExpression,
                faceDetails: charFaceDetails,
                hasModel: !!modelImage
            }
          );
          
          let rolePrefix = isBRoll ? "PRO CINEMATOGRAPHER TASK:" : "AMATEUR UGC PHOTO TASK: Capture a raw, unedited social media photo. ABSOLUTE FACE CONSISTENCY REQUIRED.";
          let sceneScript = `SCENE CONTEXT: ${scriptText}. (DO NOT RENDER ANY TEXT, WORDS, OR SUBTITLES ON THE IMAGE)`;
          let colorGrading = "Natural iPhone color processing, realistic highlights and shadows.";

          let environmentText = `ENVIRONMENT: ${activeBackground}.`;
          if (selectedMode?.id === 'selfie') {
              environmentText += ` MIRROR SETTING: The mirror is located in the ${activeBackground}. The reflection MUST clearly show the ${activeBackground} environment to maintain consistency.`;
          }

          let payloadParts: any[] = [];
          
          // Index 0: Human Reference (PRIORITY)
          if (base64Model && (selectedMode?.id !== 'pov')) {
              payloadParts.push({ text: "REFERENCE IMAGE 1 (PERSON IDENTITY): THE GENERATED IMAGE MUST FEATURE THIS EXACT PERSON WITH 100% ACCURACY. NO ALTERATIONS TO FACE OR IDENTITY." });
              payloadParts.push({ inlineData: { mimeType: "image/png", data: base64Model } });
          }

          // Index 2: Product Reference
          if (base64ProductRaw && (selectedMode?.id !== 'model')) {
              payloadParts.push({ text: `REFERENCE IMAGE ${payloadParts.length > 0 ? 2 : 1} (PRODUCT): THE GENERATED IMAGE MUST FEATURE THIS EXACT PRODUCT WITH 100% ACCURACY. NO ALTERATIONS TO COLOR, SHAPE, OR BRANDING.` });
              payloadParts.push({ inlineData: { mimeType: "image/png", data: base64ProductRaw } });
          }

          let realismIdentity = `${REALISM_LAWS}`;
          let modelRefIndex = -1;
          let productRefIndex = -1;
          
          if (modelImage && (selectedMode?.id !== 'pov')) {
             modelRefIndex = payloadParts.findIndex(p => p.inlineData) + 1; // 1-indexed for Gemini
          }
          
          if (productImage && (selectedMode?.id !== 'model')) {
             // Find the last image index which is product
             const indices = payloadParts.map((p, idx) => p.inlineData ? idx + 1 : -1).filter(idx => idx !== -1);
             productRefIndex = indices[indices.length - 1]; 
          }

          if (!isBRoll && selectedMode?.id !== 'pov' && modelRefIndex !== -1) {
              const identityPrompt = modeParams.identityConstraint.replace('REFERENCE IMAGE 1', `REFERENCE IMAGE ${modelRefIndex}`);
              realismIdentity += ` ${identityPrompt}`;
          }
          
          if (selectedMode?.id !== 'model' && productRefIndex !== -1) {
            const productPrompt = PRODUCT_CONSISTENCY.replace('REFERENCE IMAGE 2', `REFERENCE IMAGE ${productRefIndex}`);
            realismIdentity += ` ${productPrompt}`;
          }

          let finalMandatory = "NO TEXT OR OVERLAYS ALLOWED.";
          if (modelRefIndex !== -1) {
              finalMandatory += ` THE FACE IN THE RESULT MUST BE A 100% IDENTICAL CLONE OF REFERENCE IMAGE ${modelRefIndex}.`;
          }
          if (productRefIndex !== -1) {
              finalMandatory += ` THE PRODUCT IN THE RESULT MUST BE A 100% IDENTICAL CLONE OF REFERENCE IMAGE ${productRefIndex}.`;
          }

          let globalNeg = ", text, watermark, logo, UI, buttons, icons, hearts, comments, overlay, subtitles, captions, words, letters, typography, visual effects, digital overlays, graphics, banners, stickers, AI, AI generated look, midjourney, stable diffusion, unreal engine, 3d, render, CGI, flawless perfect lighting, cinematic movie shot, professional photography, DSLR, 8k, high res, studio flash, plastic skin, airbrushed, doll-like, HDR, glossy, over-saturated, excessively symmetrical face, beauty filter, floating product, bad product integration, blurry product labels, mannequin, uncanny valley, digital art, computer graphics, fake skin, plastic texture";
          let diffusionPrompt = `${realismIdentity} ${rolePrefix} ${sceneScript} ${colorGrading} ${modeParams.cameraLogic} ${modeParams.subjectPrompt} ${environmentText} FINAL_MANDATORY_INSTRUCTION: ${finalMandatory} NEGATIVE: ${modeParams.negPrompt} ${globalNeg}`;
          payloadParts.push({ text: diffusionPrompt });

          const response = await executeWithRetry(() => imageAi.models.generateContent({
            model: GENERATIVE_MODEL,
            contents: [{ parts: payloadParts }],
            config: { 
              systemInstruction: "CRITICAL: You are an iPhone 15 Pro camera. Your absolute priority is 100% FACE, GENDER, HAIR, AND PRODUCT CONSISTENCY. The person in the generated image MUST be an identical clone of REFERENCE IMAGE 1 (MATCH GENDER, HAIR, FACE SHAPE, AND POSTURE EXACTLY). The product in the generated image MUST be an identical clone of REFERENCE IMAGE 2. MAINTAIN EXACT SCALE AND PROPORTIONS. The product's size must be realistic and consistent across all scenes. No alterations allowed. The style is RAW, UNEDITED, and AUTHENTIC IPHONE PHOTOGRAPHY. LIGHTING: Use natural, realistic lighting (indoor room light or natural daylight) to ensure a raw, unedited look. Avoid overly dramatic or cinematic lighting effects. Every scene must feature the EXACT same person and the EXACT same product. NO GENDER SWAPPING.",
              imageConfig: {
                aspectRatio: config.ratio as any 
              }
            }
          }));

          const base64Output = response.candidates?.[0]?.content?.parts?.find(p => p.inlineData)?.inlineData?.data;
          if (base64Output) {
            const imgSrc = `data:image/png;base64,${base64Output}`;
            const defaultVoActive = !isBRoll && (selectedMode?.id === 'ugc');
            const scenarioData = { 
                src: imgSrc, role, action: modeParams.subjectPrompt, scriptHint: scriptText,
                videoMotion: modeParams.motionCamera, videoCamera: modeParams.cameraLogic, activeBackground, isBRoll,
                voActive: defaultVoActive, voText: scriptText
            };
            setGeneratedImages(prev => {
               const newArr = [...prev];
               newArr[i] = scenarioData;
               return newArr;
            });
          }
        } catch (err: any) {
          console.error(`Scene ${i} failed:`, err);
          const isQuotaError = JSON.stringify(err).includes('RESOURCE_EXHAUSTED') || JSON.stringify(err).includes('quota');
          if (isQuotaError) {
             setGlobalError(`Kuota Gemini API Habis. Silakan beralih ke API Key berbayar (Pay-as-you-go) di Google AI Studio untuk menghilangkan limitasi ini.`);
             break; // Stop loop if quota is empty
          } else {
             setGlobalError(`Gagal membuat gambar untuk adegan ke-${i+1}. Silakan coba klik regenerasi nanti.`);
          }
        }
      }
    } catch (err: any) {
      console.error(err);
      setGlobalError("Terjadi kesalahan saat proses pembuatan kampanye. Coba cek koneksi atau upload ulang aset Anda.");
    } finally {
      setIsGenerating(false);
      setCooldown(90);
    }
  };

  const regenerateSingleScene = async (index: number, customInstruction?: string) => {
    playClick();
    
    if (customInstruction) {
        // Update Prompt case: Don't regenerate image, just update state and feedback
        setSceneLoadings(prev => ({ ...prev, [index]: true }));
        await new Promise(resolve => setTimeout(resolve, 600));
        updateSceneData(index, { voText: customInstruction });
        setSceneLoadings(prev => ({ ...prev, [index]: false }));
        return;
    }

    const revisionInstruction = scenePrompts[index] || "";
    const originalScenario = generatedImages[index]; 
    const activeBackground = bgType === 'custom' ? (customBg || 'Studio Foto Polos') : config.background;
    
    setSceneLoadings(prev => ({ ...prev, [index]: true }));
    setGlobalError(null);

    try {
      const resizedModel = modelImage ? await resizeImage(modelImage, 768, 768) : null;
      const resizedProduct = productImage ? await resizeImage(productImage, 768, 768) : null;
      
      const base64Model = resizedModel ? resizedModel.split(',')[1] : null;
      const base64ProductRaw = resizedProduct ? resizedProduct.split(',')[1] : null;

      const imageAi = new GoogleGenAI({ apiKey: process.env.API_KEY || process.env.GEMINI_API_KEY || "" });

      let envDetails = `Background: ${activeBackground}.`;
      if (selectedMode?.id === 'selfie') {
          envDetails += " FIXED MIRROR ROOM DETAILS: To ensure 100% background consistency, the room MUST feature these exact elements in the reflection: a minimalist modern bedroom with a cream-colored wall, a small wooden bedside table with a warm lamp on the left, and a large floor-to-ceiling mirror with a thin black frame. The lighting is soft natural window light from the right side.";
      }

      const payloadParts: any[] = [];
      if (base64Model && (selectedMode?.id !== 'pov')) {
          payloadParts.push({ text: "REFERENCE IMAGE 1 (PERSON IDENTITY): THE GENERATED IMAGE MUST FEATURE THIS EXACT PERSON WITH 100% ACCURACY." });
          payloadParts.push({ inlineData: { mimeType: "image/png", data: base64Model } });
      }
      if (base64ProductRaw && (selectedMode?.id !== 'model')) {
          payloadParts.push({ text: `REFERENCE IMAGE ${payloadParts.length > 0 ? 2 : 1} (PRODUCT): THE GENERATED IMAGE MUST FEATURE THIS EXACT PRODUCT WITH 100% ACCURACY.` });
          payloadParts.push({ inlineData: { mimeType: "image/png", data: base64ProductRaw } });
      }

      let modelRefIndex = -1;
      let productRefIndex = -1;
      
      if (modelImage && (selectedMode?.id !== 'pov')) {
         modelRefIndex = payloadParts.findIndex(p => p.inlineData) + 1; // 1-indexed for Gemini
      }
      
      if (productImage && (selectedMode?.id !== 'model')) {
         const indices = payloadParts.map((p, idx) => p.inlineData ? idx + 1 : -1).filter(idx => idx !== -1);
         productRefIndex = indices[indices.length - 1]; 
      }

      let realismIdentity = `${REALISM_LAWS}`;
      if (selectedMode?.id !== 'pov' && modelRefIndex !== -1) {
          const identityPrompt = IDENTITY_LOCK.replace('REFERENCE IMAGE 1', `REFERENCE IMAGE ${modelRefIndex}`);
          realismIdentity += ` ${identityPrompt}`;
      }
      if (selectedMode?.id !== 'model' && productRefIndex !== -1) {
          const productPrompt = PRODUCT_CONSISTENCY.replace('REFERENCE IMAGE 2', `REFERENCE IMAGE ${productRefIndex}`);
          realismIdentity += ` ${productPrompt}`;
      }

      let finalMandatory = "NO TEXT OR OVERLAYS ALLOWED.";
      if (modelRefIndex !== -1) {
          finalMandatory += ` THE FACE IN THE RESULT MUST BE A 100% IDENTICAL CLONE OF REFERENCE IMAGE ${modelRefIndex}.`;
      }
      if (productRefIndex !== -1) {
          finalMandatory += ` THE PRODUCT IN THE RESULT MUST BE A 100% IDENTICAL CLONE OF REFERENCE IMAGE ${productRefIndex}.`;
      }

      const systemPrompt = `
      REVISION MODE. Target: Regenerate Scene ${index + 1}.
      Product: ${productName} (${productDesc})
      User Instruction: ${revisionInstruction || "Improve lighting and expression."}
      Keep original action: ${originalScenario.action || "Showing the product"}. ${envDetails}
      ${realismIdentity}
      MANDATORY: ${finalMandatory}
      MANDATORY: NO TEXT, NO OVERLAYS, NO UI. SINGLE HARSH LIGHT ONLY.
      NEGATIVE: AI, midjourney, stable diffusion, unreal engine, 3d, render, CGI, plastic skin, airbrushed, doll-like, excessively symmetrical face, beauty filter, low quality, blurry, distorted, watermark, text, logo, floating product, bad product integration, blurry product labels, UI, captions, subtitles.
      `;

      payloadParts.push({ text: systemPrompt });

      const response = await imageAi.models.generateContent({
        model: GENERATIVE_MODEL,
        contents: [{ parts: payloadParts }],
          config: { 
          systemInstruction: `CRITICAL: You are an iPhone 15 Pro camera. Your absolute priority is 100% FACE AND PRODUCT CONSISTENCY. ${modelRefIndex !== -1 ? `The face in the generated image MUST be an identical clone of REFERENCE IMAGE ${modelRefIndex}.` : ""} ${productRefIndex !== -1 ? `The product in the generated image MUST be an identical clone of REFERENCE IMAGE ${productRefIndex}.` : ""} MAINTAIN EXACT SCALE AND PROPORTIONS. The product's size must be realistic and consistent across all scenes. No alterations allowed. The style is RAW, UNEDITED, and AUTHENTIC IPHONE PHOTOGRAPHY. LIGHTING: Use a single harsh light source to create strong shadows and high contrast. Every scene must feature the EXACT same person and the EXACT same product.`,
          imageConfig: {
            aspectRatio: config.ratio as any 
          }
        }
      });

      const base64Output = response.candidates?.[0]?.content?.parts?.find(p => p.inlineData)?.inlineData?.data;
      if (base64Output) {
        const imgSrc = `data:image/png;base64,${base64Output}`;
        setGeneratedImages(prev => {
          const newArr = [...prev];
          newArr[index] = { ...newArr[index], src: imgSrc }; 
          return newArr;
        });
        setScenePrompts(prev => ({ ...prev, [index]: "" }));
      }
    } catch (err: any) {
      console.error("Scene regeneration error:", err);
      setGlobalError("Gagal memperbarui adegan. Silakan coba lagi dalam beberapa saat.");
    } finally {
      setSceneLoadings(prev => ({ ...prev, [index]: false }));
      setCooldown(30);
    }
  };

  const handleGenerateVOScript = async () => {
      playClick();
      setIsGeneratingVOScript(true);
      const prompt = `Buatkan naskah master voiceover gaya ${selectedMode?.title || 'Komersial'} untuk ${productName || 'Produk'}. Durasi: ${voDuration}. Bahasa Indonesia. HANYA berikan teks naskahnya saja tanpa penjelasan, tanda kutip di awal/akhir, atau teks tambahan lainnya.`;
      try {
          const response = await ai.models.generateContent({
              model: TEXT_MODEL,
              contents: [{ parts: [{ text: prompt }] }]
          });
          const text = response.text;
          if (text) setVoScript(text.trim());
      } catch (err: any) {
          console.error("Master VO Script gen error", err);
          setGlobalError("Gagal membuat naskah Voiceover. Silakan tulis naskah Anda sendiri di kolom yang tersedia.");
      } finally {
          setIsGeneratingVOScript(false);
          setCooldown(10);
      }
  };

  const handleGenerateVOAudio = async () => {
      if (!voScript) return;
      playClick();
      setIsGeneratingVOAudio(true);
      setVoAudioUrl(null);

      try {
          const response = await ai.models.generateContent({
            model: TTS_MODEL,
            contents: [{ parts: [{ text: `Bacakan dengan nada ${voTone}: ${voScript}` }] }],
            config: {
                responseModalities: [Modality.AUDIO],
                speechConfig: {
                    voiceConfig: {
                        prebuiltVoiceConfig: { voiceName: voVoice }
                    }
                }
            }
          });

          const base64PCM = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
          if (base64PCM) {
              const url = base64ToWavUrl(base64PCM);
              setVoAudioUrl(url);
          }
      } catch (err) {
          console.error("Audio generation failed:", err);
      } finally {
          setIsGeneratingVOAudio(false);
          setCooldown(15);
      }
  };

  const handleGenerateSceneAudio = async (index: number) => {
    const scene = generatedImages[index];
    if (!scene || !scene.voText) return;
    
    playClick();
    setAudioLoadings(prev => ({ ...prev, [index]: true }));
    setGlobalError(null);
    
    try {
        const response = await ai.models.generateContent({
            model: TTS_MODEL,
            contents: [{ parts: [{ text: `Bacakan dengan nada ${voTone}: ${scene.voText}` }] }],
            config: {
                responseModalities: [Modality.AUDIO],
                speechConfig: {
                    voiceConfig: {
                        prebuiltVoiceConfig: { voiceName: voVoice }
                    }
                }
            }
        });

        const base64PCM = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
        if (base64PCM) {
            const audioUrl = base64ToWavUrl(base64PCM);
            updateSceneData(index, { audioUrl });
        }
    } catch (err: any) {
        console.error("Scene audio generation failed:", err);
        setGlobalError("Gagal mengubah teks menjadi suara. Coba ganti pilihan suara atau nada bicaranya.");
    } finally {
        setAudioLoadings(prev => ({ ...prev, [index]: false }));
        setCooldown(15);
    }
  };

  const handleGenerateVideo = async (index: number) => {
    const scene = generatedImages[index];
    if (!scene || !scene.src) return;
    
    playClick();
    setVideoLoadings(prev => ({ ...prev, [index]: true }));
    setGlobalError(null);
    
    try {
        // Create a new instance right before call as per skill guidance
        const videoAi = new GoogleGenAI({ apiKey: process.env.API_KEY || process.env.GEMINI_API_KEY || "" });
        
        const base64Image = scene.src.split(',')[1];
        const prompt = `ULTRA-REALISTIC VIDEO GENERATION. Create a high-quality, cinematic video based on this image. ${scene.videoMotion || "Slow cinematic pan."} ${scene.videoCamera || "Handheld smartphone style."} Maintain 100% pixel-perfect consistency with the image. Ensure natural lighting, realistic textures, and fluid motion. No flickering, no artifacts. Professional grade output.`;
        
        let operation = await videoAi.models.generateVideos({
            model: VIDEO_MODEL,
            prompt: prompt,
            image: {
                imageBytes: base64Image,
                mimeType: 'image/png',
            },
            config: {
                numberOfVideos: 1,
                resolution: '720p',
                aspectRatio: config.ratio === '9:16' ? '9:16' : config.ratio === '16:9' ? '16:9' : '16:9'
            }
        });

        while (!operation.done) {
            await new Promise(resolve => setTimeout(resolve, 5000));
            operation = await videoAi.operations.getVideosOperation({ operation: operation });
        }

        const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
        if (downloadLink) {
            const response = await fetch(downloadLink, {
                method: 'GET',
                headers: {
                    'x-goog-api-key': process.env.API_KEY || process.env.GEMINI_API_KEY || "",
                },
            });
            
            if (!response.ok) {
                if (response.status === 403) {
                    throw new Error("PERMISSION_DENIED: Akses Video AI ditolak. Pastikan kuota harian Anda masih tersedia.");
                }
                throw new Error(`Failed to fetch video: ${response.statusText}`);
            }

            const blob = await response.blob();
            const videoUrl = URL.createObjectURL(blob);
            
            updateSceneData(index, { videoUrl });
        }
    } catch (err: any) {
        console.error("Video generation failed:", err);
        if (err.message?.includes("Requested entity was not found")) {
            setGlobalError("Sesi API kadaluarsa atau tidak valid. Silakan coba lagi nanti.");
        } else if (err.message?.includes("PERMISSION_DENIED")) {
            setGlobalError("Izin Video AI ditolak (403). Fitur video ini memerlukan kuota khusus dari Google AI Studio.");
        } else {
            setGlobalError("Gagal membuat video dari gambar ini. Pastikan kuota harian Anda masih tersedia.");
        }
    } finally {
        setVideoLoadings(prev => ({ ...prev, [index]: false }));
        setCooldown(45);
    }
  };

   const handleDownloadAll = async () => {
    if (generatedImages.length === 0) return;
    playClick();
    const zip = new JSZip();
    const rootFolder = zip.folder(`${productName.replace(/\s+/g, '_') || 'campaign'}_assets`);
    
    for (let i = 0; i < generatedImages.length; i++) {
        const scene = generatedImages[i];
        if (!scene) continue;

        const sceneFolderName = `Scene_${i + 1}`;
        const sceneFolder = rootFolder?.folder(sceneFolderName);
        
        // Image
        if (scene.src) {
            const imgData = await processImageForDownload(scene.src, config.ratio);
            const base64Data = imgData.split(',')[1];
            sceneFolder?.file(`image.png`, base64Data, { base64: true });
        }

        // Video
        if (scene.videoUrl) {
            const response = await fetch(scene.videoUrl);
            const blob = await response.blob();
            sceneFolder?.file(`video.mp4`, blob);
        }

        // Prompt Text
        let contextLogic = "";
        if (scene.voActive) {
            contextLogic = scene.isBRoll ? `NARRATIVE VOICE-OVER: '${scene.voText}'.` : `LIP-SYNC: Model is speaking: '${scene.voText}'.`;
        } else {
            contextLogic = scene.isBRoll ? "AMBIENT: No human visible." : "AMBIENT: No talking.";
        }
        const promptText = `SCENE ${i+1} PROMPT\n\nPROMPT: ${scene.videoMotion}\nCAMERA: ${scene.videoCamera}\nCONTEXT: ${contextLogic}\nENVIRONMENT: ${scene.activeBackground}\n\nGenerated via KontenKit Pro`;
        sceneFolder?.file(`prompt.txt`, promptText);
    }
    
    const content = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(content);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${productName.replace(/\s+/g, '_') || 'kontenkit_pro'}_all_assets.zip`;
    a.click();
  };

  const handleCopyAllPrompts = () => {
    playClick();
    const allPrompts = generatedImages.map((scene, i) => {
        let contextLogic = "";
        if (scene.voActive) {
            contextLogic = scene.isBRoll ? `NARRATIVE VOICE-OVER: '${scene.voText}'.` : `LIP-SYNC: Model is speaking: '${scene.voText}'.`;
        } else {
            contextLogic = scene.isBRoll ? "AMBIENT: No human visible." : "AMBIENT: No talking.";
        }
        return `SCENE ${i+1}:\nPROMPT: ${scene.videoMotion}\nCAMERA: ${scene.videoCamera}\nCONTEXT: ${contextLogic}\nENVIRONMENT: ${scene.activeBackground}\n`;
    }).join("\n---\n\n");
    
    safeCopyToClipboard(allPrompts);
    alert("Semua prompt video berhasil disalin ke clipboard!");
  };

  const renderContent = () => {
    switch (view) {
      case 'welcome':
        return (
          <LayoutWrapper>
            <div className="flex-grow flex flex-col items-center justify-center relative w-full h-full min-h-screen px-6 overflow-hidden">
              <AnimatePresence>
                <motion.div 
                  key="landing"
                  initial={{ opacity: 1 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="flex flex-col items-center gap-12 w-full max-w-3xl"
                >
                  <div className="flex flex-col items-center gap-4">
                    <motion.div 
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex items-center gap-2.5 px-4 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/25 backdrop-blur-md"
                    >
                       <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                       <span className="text-[10px] font-bold tracking-[0.25em] text-emerald-300 uppercase font-mono">Studio Siap Digunakan</span>
                    </motion.div>
                    <motion.h1 
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 1, delay: 0.2, ease: "easeOut" }}
                      className="text-5xl md:text-8xl font-black tracking-tight text-white text-center uppercase drop-shadow-[0_0_45px_rgba(16,185,129,0.35)] leading-none"
                    >
                      KontenKit <span className="text-emerald-400">Pro</span>
                    </motion.h1>
                  </div>

                  <div className="space-y-12 flex flex-col items-center w-full">
                    <motion.p 
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.6 }}
                      className="text-zinc-300 text-sm md:text-xl font-normal tracking-normal leading-relaxed text-center px-4 max-w-xl"
                    >
                      Ubah produkmu jadi visual kampanye berkonversi tinggi dengan kekuatan AI studio yang fotorealistis dan konsisten.
                    </motion.p>

                    <div className="flex flex-col items-center gap-5">
                      <motion.button
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ 
                          type: "spring",
                          stiffness: 260,
                          damping: 20,
                          delay: 0.8 
                        }}
                        whileHover={{ scale: 1.08 }}
                        whileTap={{ scale: 0.94 }}
                        onClick={() => { setView('mode-selection'); }}
                        className="w-24 h-24 rounded-full bg-emerald-500 flex items-center justify-center shadow-[0_0_45px_rgba(16,185,129,0.45)] relative group cursor-pointer hover:bg-emerald-400 transition-colors"
                      >
                        <div className="absolute inset-0 rounded-full border-2 border-emerald-400 animate-ping opacity-25" />
                        <ArrowRight className="w-8 h-8 text-black group-hover:translate-x-0.5 transition-transform" />
                      </motion.button>
                      <motion.span 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 1 }}
                        className="text-[11px] font-semibold tracking-[0.25em] uppercase text-emerald-300/80"
                      >
                        Buka Studio Konten
                      </motion.span>
                    </div>
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>
          </LayoutWrapper>
        );

      case 'mode-selection':
        return (
          <LayoutWrapper>
            <Navbar onBack={() => { setView('welcome'); }} cooldown={cooldown} />
            <DraggableBackButton onClick={() => { setView('welcome'); }} />
            <div className="flex-grow flex flex-col px-4 pt-12 pb-12 md:px-12 md:pt-16 lg:px-24">
              <div className="max-w-7xl mx-auto w-full">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mb-12"
                >
                  <h2 className="text-3xl md:text-6xl font-bold tracking-tight text-white mb-3">Mau Buat Konten Apa Hari Ini?</h2>
                  <p className="text-zinc-400 text-sm md:text-base font-normal max-w-xl">Pilih gaya visual yang paling tepat untuk audiens dan produkmu.</p>
                </motion.div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {MODES.map((mode, i) => {
                    const colors = [
                      'bento-card-lime',
                      'bento-card-pink',
                      'bento-card-lime',
                      'bento-card-blue',
                      'bento-card-orange',
                      'bento-card-teal'
                    ];
                    const color = colors[i % colors.length];
                    const Icon = mode.icon;
                    
                    return (
                      <motion.button 
                        key={mode.id}
                        whileHover={{ scale: 0.98 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => { setSelectedMode(mode); setDynamicBackgrounds((MODE_BACKGROUNDS as any)[mode.id]); setConfig(prev => ({...prev, background: (MODE_BACKGROUNDS as any)[mode.id][0]})); setView('upload-setup'); }}
                        className={`bento-card ${color} w-full text-left min-h-[160px] flex flex-col justify-between p-6 cursor-pointer`}
                      >
                        <div className="flex items-center justify-between">
                           <div className="w-10 h-10 rounded-full border border-black/10 flex items-center justify-center bg-white/10 backdrop-blur-sm"><Icon className="w-5 h-5" /></div>
                           <ArrowRight className="w-5 h-5 rotate-[-45deg]" />
                        </div>
                        <div>
                          <h3 className="text-2xl font-bold leading-tight uppercase tracking-tighter">{mode.title}</h3>
                          <p className="text-[10px] font-medium opacity-70 uppercase tracking-widest mt-1">{mode.desc}</p>
                        </div>
                      </motion.button>
                    );
                  })}
                </div>
              </div>
            </div>
          </LayoutWrapper>
        );

      case 'upload-setup':
        const isUploadComplete = (
          (selectedMode?.id === 'model' ? !!modelImage : (selectedMode?.id === 'pov' || (selectedMode?.id === 'food') ? true : !!modelImage)) && 
          (selectedMode?.id === 'model' ? true : (selectedMode?.id === 'vlog' ? (!!modelImage || !!productImage) : !!productImage))
        );
        return (
          <LayoutWrapper>
            <Navbar onBack={() => setView('mode-selection')} onViewResult={generatedImages.length > 0 ? () => setView('result') : null} cooldown={cooldown} />
            <DraggableBackButton onClick={() => setView('mode-selection')} />
            {globalError && (
              <div className="fixed top-24 left-1/2 -translate-x-1/2 z-[100] w-full max-w-md px-4 animate-in fade-in slide-in-from-top-4">
                <div className="bg-[#170808]/90 border border-red-500/40 backdrop-blur-md p-4 rounded-2xl flex items-start gap-3 shadow-2xl">
                  <div className="bg-red-500 rounded-full p-1 mt-0.5"><X className="w-3 h-3 text-white" /></div>
                  <div className="flex-grow">
                    <p className="text-xs font-bold text-red-400 uppercase tracking-widest mb-1">Ada Sedikit Kendala</p>
                    <p className="text-[11px] text-zinc-300 leading-relaxed mb-1">{globalError}</p>
                    <p className="text-[10px] text-zinc-400 font-medium">Silakan coba beberapa saat lagi atau periksa koneksi Anda.</p>
                  </div>
                  <button onClick={() => setGlobalError(null)} className="text-zinc-500 hover:text-white transition-colors"><X className="w-4 h-4" /></button>
                </div>
              </div>
            )}
            <div className="flex-grow flex flex-col px-4 pt-12 pb-12 md:px-12 md:pt-16 lg:px-24">
               <div className="max-w-6xl mx-auto w-full flex flex-col gap-12">
                  <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-emerald-500/15 pb-8">
                    <div className="space-y-1">
                      <h2 className="text-3xl md:text-5xl font-black tracking-tight text-white uppercase italic leading-none">Setup <span className="text-emerald-400">Materi Kampanye</span></h2>
                      <p className="text-[10px] md:text-xs font-bold text-emerald-300/70 uppercase tracking-[0.3em]">Persiapkan materi untuk mode {selectedMode?.title}</p>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="flex -space-x-2">
                        {[1, 2].map(i => (
                          <div key={i} className={`w-8 h-8 rounded-full border-2 border-[#040D08] flex items-center justify-center text-[10px] font-bold ${isUploadComplete && isProductConfirmed ? 'bg-emerald-500 text-black shadow-[0_0_15px_rgba(16,185,129,0.35)]' : 'bg-[#061810] text-emerald-400/50 border border-emerald-500/20'}`}>
                            {i}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-8 lg:grid-cols-12">
                    <div className="lg:col-span-12 xl:col-span-5 space-y-8">
                      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-1 gap-6">
                        {(selectedMode?.id !== 'pov' && selectedMode?.id !== 'food' && selectedMode?.id !== 'model') && (
                          <UploadZone 
                            label="Referensi Model" 
                            image={modelImage} 
                            onClick={() => modelInputRef.current?.click()} 
                            onClear={() => setModelImage(null)}
                            icon={Camera} 
                          />
                        )}
                        {selectedMode?.id === 'model' && (
                          <UploadZone 
                            label="Karakter Model (Base)" 
                            image={modelImage} 
                            onClick={() => modelInputRef.current?.click()} 
                            onClear={() => setModelImage(null)}
                            icon={UserCheck} 
                          />
                        )}
                        {selectedMode?.id === 'food' && (
                          <UploadZone 
                            label="Lifestyle Model (Opsional)" 
                            image={modelImage} 
                            onClick={() => modelInputRef.current?.click()} 
                            onClear={() => setModelImage(null)}
                            icon={UserCheck} 
                          />
                        )}
                        {selectedMode?.id !== 'model' && (
                          <UploadZone 
                              label={selectedMode?.id === 'food' ? "Foto Dasar Makanan" : "Subjek Produk"} 
                              image={productImage} 
                              onClick={() => productInputRef.current?.click()} 
                              onClear={() => setProductImage(null)}
                              icon={Package} 
                          />
                        )}
                      </div>
                    </div>

                    <div className="lg:col-span-12 xl:col-span-7">
                       <div className="bg-[#07170F]/95 border border-emerald-500/20 rounded-[2.5rem] p-8 md:p-12 space-y-10 shadow-2xl relative overflow-hidden h-full flex flex-col">
                            <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-[100px] pointer-events-none" />
                            
                            <div className="space-y-8 flex-grow">
                               {selectedMode?.id === 'model' ? (
                                   <div className="space-y-6">
                                       <div className="flex flex-col gap-1.5">
                                           <h3 className="text-sm font-bold text-white uppercase tracking-wider">Kustomisasi Karakter</h3>
                                           <p className="text-[11px] text-zinc-400 leading-normal">Sesuaikan atribut dan karakter model yang ingin kamu tampilkan.</p>
                                       </div>

                                       <div className="grid grid-cols-2 gap-4">
                                           <div className="space-y-2">
                                               <label className="text-[9px] font-bold uppercase tracking-[0.3em] text-emerald-300/80 ml-1">Mode Identitas</label>
                                               <select 
                                                 value={charIdentity} 
                                                 onChange={(e) => setCharIdentity(e.target.value)}
                                                 className="w-full bg-[#040D08]/90 border border-emerald-500/20 text-zinc-100 rounded-xl px-4 py-3 text-[11px] focus:outline-none focus:ring-1 focus:ring-emerald-400/40"
                                               >
                                                   <option value="exact">100% Kloning Identik</option>
                                                   <option value="inspired">Identitas Baru (Terinspirasi)</option>
                                               </select>
                                           </div>
                                           <div className="space-y-2">
                                               <label className="text-[9px] font-bold uppercase tracking-[0.3em] text-emerald-300/80 ml-1">Gender</label>
                                               <select 
                                                 value={charGender} 
                                                 onChange={(e) => setCharGender(e.target.value)}
                                                 className="w-full bg-[#040D08]/90 border border-emerald-500/20 text-zinc-100 rounded-xl px-4 py-3 text-[11px] focus:outline-none focus:ring-1 focus:ring-emerald-400/40"
                                               >
                                                   <option value="Female">Female</option>
                                                   <option value="Male">Male</option>
                                                   <option value="Non-binary">Non-binary</option>
                                                   <option value="Androgynous">Androgynous</option>
                                                   <option value="Genderfluid">Genderfluid</option>
                                               </select>
                                           </div>
                                       </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                           <div className="space-y-2">
                                               <label className="text-[9px] font-bold uppercase tracking-[0.3em] text-emerald-300/80 ml-1">Gaya & Warna Rambut</label>
                                               <select 
                                                 value={charHair} 
                                                 onChange={(e) => setCharHair(e.target.value)}
                                                 className="w-full bg-[#040D08]/90 border border-emerald-500/20 text-zinc-100 rounded-xl px-4 py-3 text-[11px] focus:outline-none focus:ring-1 focus:ring-emerald-400/40"
                                               >
                                                   {CHAR_HAIR_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                               </select>
                                           </div>
                                           <div className="space-y-2">
                                               <label className="text-[9px] font-bold uppercase tracking-[0.3em] text-emerald-300/80 ml-1">Pakaian / Outfit</label>
                                               <select 
                                                 value={charOutfit} 
                                                 onChange={(e) => setCharOutfit(e.target.value)}
                                                 className="w-full bg-[#040D08]/90 border border-emerald-500/20 text-zinc-100 rounded-xl px-4 py-3 text-[11px] focus:outline-none focus:ring-1 focus:ring-emerald-400/40"
                                               >
                                                   {CHAR_OUTFIT_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                               </select>
                                           </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-4">
                                           <div className="space-y-2">
                                               <label className="text-[9px] font-bold uppercase tracking-[0.3em] text-emerald-300/80 ml-1">Rentang Usia</label>
                                               <select 
                                                 value={charAge} 
                                                 onChange={(e) => setCharAge(e.target.value)}
                                                 className="w-full bg-[#040D08]/90 border border-emerald-500/20 text-zinc-100 rounded-xl px-4 py-3 text-[11px] focus:outline-none focus:ring-1 focus:ring-emerald-400/40"
                                               >
                                                   {CHAR_AGE_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                               </select>
                                           </div>
                                           <div className="space-y-2">
                                               <label className="text-[9px] font-bold uppercase tracking-[0.3em] text-emerald-300/80 ml-1">Etnis / Tampilan</label>
                                               <select 
                                                 value={charEthnicity} 
                                                 onChange={(e) => setCharEthnicity(e.target.value)}
                                                 className="w-full bg-[#040D08]/90 border border-emerald-500/20 text-zinc-100 rounded-xl px-4 py-3 text-[11px] focus:outline-none focus:ring-1 focus:ring-emerald-400/40"
                                               >
                                                   {CHAR_ETHNICITY_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                               </select>
                                           </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-4">
                                           <div className="space-y-2">
                                               <label className="text-[9px] font-bold uppercase tracking-[0.3em] text-emerald-300/80 ml-1">Bentuk Tubuh</label>
                                               <select 
                                                 value={charBody} 
                                                 onChange={(e) => setCharBody(e.target.value)}
                                                 className="w-full bg-[#040D08]/90 border border-emerald-500/20 text-zinc-100 rounded-xl px-4 py-3 text-[11px] focus:outline-none focus:ring-1 focus:ring-emerald-400/40"
                                               >
                                                   {CHAR_BODY_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                               </select>
                                           </div>
                                           <div className="space-y-2">
                                               <label className="text-[9px] font-bold uppercase tracking-[0.3em] text-emerald-300/80 ml-1">Warna Mata</label>
                                               <select 
                                                 value={charEyes} 
                                                 onChange={(e) => setCharEyes(e.target.value)}
                                                 className="w-full bg-[#040D08]/90 border border-emerald-500/20 text-zinc-100 rounded-xl px-4 py-3 text-[11px] focus:outline-none focus:ring-1 focus:ring-emerald-400/40"
                                               >
                                                   {CHAR_EYE_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                               </select>
                                           </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-4">
                                           <div className="space-y-2">
                                               <label className="text-[9px] font-bold uppercase tracking-[0.3em] text-emerald-300/80 ml-1">Ekspresi Wajah</label>
                                               <select 
                                                 value={charExpression} 
                                                 onChange={(e) => setCharExpression(e.target.value)}
                                                 className="w-full bg-[#040D08]/90 border border-emerald-500/20 text-zinc-100 rounded-xl px-4 py-3 text-[11px] focus:outline-none focus:ring-1 focus:ring-emerald-400/40"
                                               >
                                                   {CHAR_EXPRESSION_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                               </select>
                                           </div>
                                           <div className="space-y-2">
                                               <label className="text-[9px] font-bold uppercase tracking-[0.3em] text-emerald-300/80 ml-1">Detail Wajah</label>
                                               <select 
                                                 value={charFaceDetails} 
                                                 onChange={(e) => setCharFaceDetails(e.target.value)}
                                                 className="w-full bg-[#040D08]/90 border border-emerald-500/20 text-zinc-100 rounded-xl px-4 py-3 text-[11px] focus:outline-none focus:ring-1 focus:ring-emerald-400/40"
                                               >
                                                   {CHAR_FACE_DETAIL_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                               </select>
                                           </div>
                                        </div>
                                   </div>
                               ) : (
                                   <>
                                       <div className="space-y-3">
                                           <div className="flex items-center gap-2 px-1">
                                             <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                                             <label className="text-[10px] font-bold uppercase tracking-[0.3em] text-emerald-300/80">Nama & Merek Produk</label>
                                           </div>
                                           <div className="relative">
                                               {isAnalyzingProduct && <div className="absolute inset-0 bg-emerald-500/5 animate-pulse rounded-2xl z-20 flex items-center justify-center"><Loader2 className="w-6 h-6 text-emerald-400 animate-spin" /></div>}
                                               <input 
                                                 type="text" 
                                                 value={productName} 
                                                 onChange={(e) => setProductName(e.target.value)} 
                                                 placeholder={isAnalyzingProduct ? "" : (selectedMode?.id === 'food' ? "Contoh: Wagyu A5 Steak Grill..." : "Contoh: Serum Glow Botanical...")} 
                                                 className="w-full bg-[#040D08]/90 border border-emerald-500/20 text-zinc-100 rounded-2xl p-5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-400/30 focus:border-emerald-400 transition-all placeholder:text-zinc-600" 
                                               />
                                           </div>
                                       </div>

                                       <div className="space-y-3">
                                           <div className="flex items-center gap-2 px-1">
                                             <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                                             <label className="text-[10px] font-bold uppercase tracking-[0.3em] text-emerald-300/80">Deskripsi & Keunggulan Produk</label>
                                           </div>
                                           <div className="relative">
                                               {isAnalyzingProduct && <div className="absolute inset-0 bg-emerald-500/5 animate-pulse rounded-2xl z-20 flex items-center justify-center border border-emerald-500/20" />}
                                               <textarea 
                                                 value={productDesc} 
                                                 onChange={(e) => setProductDesc(e.target.value)} 
                                                 placeholder={isAnalyzingProduct ? "" : (selectedMode?.id === 'food' ? "Jelaskan bahan, rasa, tampilan menggugah selera..." : "Jelaskan fitur utama, manfaat, cara pakai...")} 
                                                 className="w-full h-40 bg-[#040D08]/90 border border-emerald-500/20 text-zinc-100 rounded-2xl p-5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-400/30 focus:border-emerald-400 transition-all resize-none placeholder:text-zinc-600" 
                                               />
                                           </div>
                                       </div>
                                   </>
                               )}
                            </div>

                            <div className="space-y-6 pt-6 border-t border-emerald-500/15">
                                <div className="flex items-center justify-between px-2">
                                    <div className="flex flex-col">
                                        <span className="text-xs font-bold text-white uppercase tracking-wider">Konfirmasi Data</span>
                                        <span className="text-[10px] text-zinc-400 leading-normal mt-0.5">Pastikan detail produk sudah sesuai sebelum lanjut</span>
                                    </div>
                                    <div className="flex justify-end">
                                      {(isProductConfirmed || (!isAnalyzingProduct && (selectedMode?.id === 'model' || (productImage && productName)))) && (
                                        <motion.button 
                                          whileHover={{ scale: 1.03 }}
                                          whileTap={{ scale: 0.97 }}
                                          onClick={() => { playClick(); setIsProductConfirmed(!isProductConfirmed); }} 
                                          className={`group flex items-center gap-2.5 px-6 py-3 rounded-full text-[10px] font-bold uppercase tracking-[0.2em] transition-all duration-300 ${isProductConfirmed ? 'bg-emerald-500 text-black shadow-[0_0_25px_rgba(16,185,129,0.4)]' : 'bg-[#0A2216] text-emerald-300 border border-emerald-500/30 hover:border-emerald-400/60'}`}
                                        >
                                          {isProductConfirmed ? <><CheckCircle2 className="w-4 h-4"/> Data Terverifikasi</> : "Verifikasi Data"}
                                        </motion.button>
                                      )}
                                    </div>
                                </div>
                                
                                <ButtonCTA disabled={!isUploadComplete || !isProductConfirmed} onClick={() => setView('config')}>
                                  Buka Studio Kreatif
                                </ButtonCTA>
                            </div>
                       </div>
                    </div>
                  </div>

                  <input type="file" ref={modelInputRef} onChange={handleModelUpload} className="hidden" />
                  <input type="file" ref={guestModelInputRef} onChange={handleGuestModelUpload} className="hidden" />
                  <input type="file" ref={productInputRef} onChange={handleProductUpload} className="hidden" />
               </div>
            </div>
          </LayoutWrapper>
        );

      case 'config':
        return (
          <LayoutWrapper>
            <Navbar onBack={() => setView('upload-setup')} onViewResult={generatedImages.length > 0 ? () => setView('result') : null} cooldown={cooldown} />
            <DraggableBackButton onClick={() => setView('upload-setup')} />
            <div className="flex-grow flex flex-col px-4 pt-12 pb-12 md:px-12 md:pt-16 lg:px-24 bg-[#040D08] relative overflow-hidden">
              {/* Background Ambient Forest Gradients */}
              <div className="absolute inset-0 pointer-events-none">
                <div className="absolute top-[-10%] left-[-10%] w-[45%] h-[45%] bg-emerald-500/5 rounded-full blur-[140px]"></div>
                <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-[#0A2619]/40 rounded-full blur-[160px]"></div>
              </div>

              <div className="max-w-7xl mx-auto w-full grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 relative z-10">
                <div className="lg:col-span-7 space-y-12">
                  <motion.div 
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                  >
                    <SectionTitle title="Konfigurasi Studio" subtitle="Sesuaikan latar, rasio frame, dan jumlah scene untuk hasil kampanye yang presisi." />
                  </motion.div>
                  
                  <div className="space-y-8">
                    {/* Background Studio Card */}
                    <motion.div 
                      initial={{ opacity: 0, y: 30 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.8, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
                      className="group relative bg-[#07170F]/95 border border-emerald-500/20 p-6 md:p-10 rounded-2xl md:rounded-[2.5rem] transition-all duration-500 hover:border-emerald-500/35 shadow-2xl overflow-hidden"
                    >
                      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-emerald-400/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700"></div>
                      <div className="flex items-center gap-4 mb-8">
                        <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20 group-hover:bg-emerald-500/20 transition-colors duration-500">
                          <Layout className="w-5 h-5 text-emerald-400" />
                        </div>
                        <div className="flex flex-col text-left">
                          <label className="text-[10px] font-bold uppercase tracking-[0.3em] text-white">Latar Belakang Studio</label>
                          <span className="text-[9px] text-zinc-400 font-medium uppercase tracking-widest">Pilih suasana visual kampanye</span>
                        </div>
                      </div>
                      <div className="relative">
                        <select 
                          value={bgType === 'custom' ? 'CUSTOM' : config.background} 
                          onChange={(e) => { playClick(); if (e.target.value === 'CUSTOM') setBgType('custom'); else { setBgType('preset'); setConfig({...config, background: e.target.value}); } }} 
                          className={`w-full ${themeInputClass} rounded-2xl px-8 py-6 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400/30 transition-all appearance-none cursor-pointer`}
                        >
                          {dynamicBackgrounds.map(bg => <option key={bg} value={bg} className="bg-[#07170F] text-zinc-100">{bg}</option>)}
                          <option value="CUSTOM" className="bg-[#07170F] text-emerald-300">✨ Latar Kustom Sendiri...</option>
                        </select>
                        <div className={`absolute right-8 top-1/2 -translate-y-1/2 pointer-events-none text-emerald-400/70`}>
                          <ChevronDown className="w-5 h-5" />
                        </div>
                      </div>
                      {bgType === 'custom' && (
                        <motion.div 
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="mt-6"
                        >
                          <input 
                            type="text" 
                            placeholder="Deskripsikan latar kustom (misal: Ruang kerja minimalis pencahayaan lembut...)" 
                            value={customBg} 
                            onChange={(e) => setCustomBg(e.target.value)} 
                            className={`w-full ${themeInputClass} rounded-2xl p-5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400/40 transition-all`} 
                          />
                        </motion.div>
                      )}
                    </motion.div>
                  </div>
                </div>

                {/* Right Column: Output Config */}
                <div className="lg:col-span-5 space-y-8">
                  <motion.div 
                    initial={{ opacity: 0, x: 40 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                    className="sticky top-40 p-8 md:p-12 rounded-2xl md:rounded-[2.5rem] border border-emerald-500/20 bg-[#07170F]/95 space-y-10 md:space-y-14 shadow-2xl overflow-hidden"
                  >
                    {/* Subtle inner glow */}
                    <div className="absolute -top-24 -right-24 w-64 h-64 bg-emerald-500/10 rounded-full blur-[80px]"></div>
                    
                    <div className="space-y-10 relative z-10">
                      {/* Aspect Ratio */}
                      <div className="space-y-5">
                        <div className="flex items-center justify-between px-2">
                          <label className="text-[10px] font-bold uppercase tracking-[0.3em] text-emerald-300/80">Rasio Frame</label>
                          <span className="text-[9px] font-bold text-emerald-300 bg-emerald-500/10 px-3 py-1 rounded-full uppercase tracking-widest border border-emerald-500/25">{config.ratio}</span>
                        </div>
                        <div className="grid grid-cols-3 gap-3.5">
                          {RATIOS.map(r => (
                            <button 
                              key={r.value} 
                              onClick={() => { playClick(); setConfig({...config, ratio: r.value}); }} 
                              className={`group relative flex flex-col items-center gap-3.5 py-5 rounded-2xl border transition-all duration-300 cursor-pointer ${config.ratio === r.value ? 'bg-emerald-500 text-black border-emerald-400 shadow-[0_0_30px_rgba(16,185,129,0.35)]' : 'bg-[#040D08]/90 text-zinc-400 border-emerald-500/15 hover:border-emerald-500/35 hover:text-emerald-200'}`}
                            >
                              <div className={`border-2 rounded-sm transition-all duration-300 ${config.ratio === r.value ? 'border-black/40' : 'border-zinc-700 group-hover:border-emerald-400/50'} ${r.value === '9:16' ? 'w-4 h-8' : r.value === '16:9' ? 'w-9 h-5' : 'w-6 h-6'}`}></div>
                              <span className="text-[9px] font-bold uppercase tracking-[0.2em]">{r.label}</span>
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Scene Counts */}
                      <div className="space-y-5">
                        <div className="flex items-center justify-between px-2">
                          <label className="text-[10px] font-bold uppercase tracking-[0.3em] text-emerald-300/80">Jumlah Scene</label>
                          <span className="text-[9px] font-bold text-emerald-300 bg-emerald-500/10 px-3 py-1 rounded-full uppercase tracking-widest border border-emerald-500/25">{config.scenes} Adegan</span>
                        </div>
                        <div className="grid grid-cols-3 gap-3.5">
                          {SCENE_COUNTS.map(count => (
                            <button 
                              key={count} 
                              onClick={() => { playClick(); setConfig({...config, scenes: count}); }} 
                              className={`py-4.5 rounded-2xl text-[11px] font-bold uppercase tracking-[0.2em] border transition-all duration-300 cursor-pointer ${config.scenes === count ? 'bg-emerald-500 text-black border-emerald-400 shadow-[0_0_30px_rgba(16,185,129,0.35)]' : 'bg-[#040D08]/90 text-zinc-400 border-emerald-500/15 hover:border-emerald-500/35 hover:text-emerald-200'}`}
                            >
                              {count}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="pt-6 space-y-6 relative z-10 border-t border-emerald-500/15">
                      <motion.button 
                        whileHover={cooldown > 0 ? {} : { scale: 1.01, y: -2 }}
                        whileTap={cooldown > 0 ? {} : { scale: 0.99 }}
                        onClick={cooldown > 0 ? undefined : generateVisual}
                        disabled={cooldown > 0}
                        className={`w-full py-5 rounded-[1.25rem] font-bold text-xs tracking-[0.3em] uppercase transition-all duration-300 flex items-center justify-center gap-3 ${cooldown > 0 ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed' : 'bg-emerald-500 text-black shadow-[0_15px_35px_-10px_rgba(16,185,129,0.4)] hover:bg-emerald-400 cursor-pointer'}`}
                      >
                        {cooldown > 0 ? `Tunggu ${cooldown}s` : 'Generate Scene Visual'}
                        <ArrowRight className="w-4 h-4" />
                      </motion.button>
                      <div className="flex items-center justify-center gap-2.5 text-zinc-500">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
                        <p className="text-[9px] font-semibold tracking-[0.25em] uppercase text-emerald-300/60">Estimasi Waktu: ~60 detik</p>
                      </div>
                    </div>
                  </motion.div>
                </div>
              </div>
            </div>
          </LayoutWrapper>
        );

      case 'result':
        return (
          <LayoutWrapper className="h-screen flex flex-col overflow-hidden bg-[#040D08]">
            <DraggableBackButton onClick={() => setView('config')} />
            {globalError && (
              <div className="fixed top-24 left-1/2 -translate-x-1/2 z-[100] w-full max-w-md px-4 animate-in fade-in slide-in-from-top-4">
                <div className="bg-[#170808]/90 border border-red-500/40 backdrop-blur-md p-4 rounded-2xl flex items-start gap-3 shadow-2xl">
                  <div className="bg-red-500 rounded-full p-1 mt-0.5"><X className="w-3 h-3 text-white" /></div>
                  <div className="flex-grow">
                    <p className="text-xs font-bold text-red-400 uppercase tracking-widest mb-1">Ada Sedikit Kendala</p>
                    <p className="text-[11px] text-zinc-300 leading-relaxed mb-1">{globalError}</p>
                    <p className="text-[10px] text-zinc-400 font-medium">Silakan coba beberapa saat lagi.</p>
                  </div>
                  <button onClick={() => setGlobalError(null)} className="text-zinc-500 hover:text-white transition-colors"><X className="w-4 h-4" /></button>
                </div>
              </div>
            )}
            {/* Redesigned Sleek Header */}
            <div className="h-20 border-b border-emerald-500/15 flex items-center justify-between px-6 md:px-16 bg-[#040D08]/85 backdrop-blur-3xl z-30 shrink-0">
              <div className="flex items-center gap-10 min-w-0">
                <div className="flex flex-col gap-0.5">
                  <div className="flex items-center gap-2.5">
                    <motion.div 
                      animate={{ scale: [1, 1.25, 1], opacity: [0.6, 1, 0.6] }}
                      transition={{ duration: 2, repeat: Infinity }}
                      className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.8)]"
                    />
                    <span className="text-[9px] text-emerald-300 font-bold uppercase tracking-[0.3em] font-mono">KontenKit Pro Studio</span>
                  </div>
                  <h1 className="text-base md:text-xl font-bold text-white uppercase tracking-tight truncate max-w-[360px]">
                    {productName || 'Proyek Visual'}
                  </h1>
                </div>
                
                <div className="hidden lg:flex items-center gap-8">
                   <div className="h-8 w-px bg-emerald-500/20"></div>
                   <div className="flex flex-col gap-0.5">
                      <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest leading-none">Suasana Studio</span>
                      <span className="text-xs text-emerald-200/90 font-medium uppercase truncate max-w-[180px]">
                        {bgType === 'custom' ? (customBg || 'Custom') : config.background}
                      </span>
                   </div>
                   <div className="flex flex-col gap-0.5">
                      <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest leading-none">Rasio Frame</span>
                      <span className="text-xs text-emerald-400 font-bold uppercase tracking-tight font-mono">{config.ratio}</span>
                   </div>
                </div>
              </div>

              <div className="flex items-center gap-6">
                {cooldown > 0 && <CooldownBadge cooldown={cooldown} />}
                
                {!isGenerating && (
                   <motion.button 
                    whileHover={{ x: -4 }}
                    onClick={() => setView('config')} 
                    className="group flex items-center gap-3 px-6 py-2.5 rounded-xl bg-[#07170F] border border-emerald-500/20 text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-300/80 hover:text-white hover:border-emerald-400/50 transition-all cursor-pointer"
                   >
                      <ArrowLeft className="w-3.5 h-3.5 transition-transform group-hover:-translate-x-1 text-emerald-400" />
                      Kembali ke Setup
                   </motion.button>
                )}
              </div>
            </div>

            <div className="flex-grow relative overflow-y-auto custom-scrollbar bg-[radial-gradient(circle_at_top,_var(--tw-gradient-stops))] from-[#071A12]/40 via-[#040D08] to-[#040D08]">
              <div className="max-w-[1920px] mx-auto p-4 md:p-8 pb-32">
                <div className={`grid gap-8 md:gap-12 ${
                  config.scenes <= 4 
                    ? 'grid-cols-1 md:grid-cols-2 max-w-6xl mx-auto' 
                    : config.scenes === 6
                    ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 max-w-7xl mx-auto'
                    : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4'
                }`}>
                  {Array.from({ length: config.scenes }).map((_, index) => {
                    const sceneData = generatedImages[index]; 
                    const image = sceneData?.src;
                    const isLoadingThis = sceneLoadings[index] || (isGenerating && !image);
                    
                    return (
                      <div key={index} className="flex flex-col gap-6 group">
                        {/* Image Container with refined frame */}
                        <div className={`relative rounded-[2rem] overflow-hidden bg-[#07170F] border border-emerald-500/20 shadow-2xl transition-all duration-500 ${config.ratio === '9:16' ? 'aspect-[9/16]' : config.ratio === '16:9' ? 'aspect-video' : 'aspect-square'} ${image ? 'hover:border-emerald-400/40 ring-0 hover:ring-1 hover:ring-emerald-400/30' : ''}`}>
                          {image ? (
                            <>
                               <img src={image} alt={`Scene ${index + 1}`} className={`w-full h-full object-cover ${config.ratio === '16:9' ? 'object-center' : 'object-top'} transition-all duration-700 ${isLoadingThis ? 'scale-105 blur-lg opacity-30' : 'group-hover:scale-105'}`} referrerPolicy="no-referrer" />
                              
                              {isLoadingThis ? (
                                 <GeneratingState index={index} />
                              ) : (
                                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-all duration-300 flex flex-col items-center justify-center gap-4 z-20 backdrop-blur-sm">
                                      <motion.button 
                                        initial={{ scale: 0.85, opacity: 0 }}
                                        whileHover={{ scale: 1.1 }}
                                        whileInView={{ scale: 1, opacity: 1 }}
                                        onClick={() => setPreviewImage(image)} 
                                        className="w-14 h-14 bg-emerald-500 text-black rounded-full flex items-center justify-center shadow-[0_0_35px_rgba(16,185,129,0.4)] transition-all cursor-pointer hover:bg-emerald-400"
                                      >
                                        <ZoomIn className="w-6 h-6" />
                                      </motion.button>
                                      <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-emerald-200">Klik untuk Preview</span>
                                  </div>
                              )}
                            </>
                          ) : (
                            <div className="absolute inset-0">
                               <GeneratingState index={index} />
                            </div>
                          )}
                          
                          {/* Label Badge */}
                          <div className="absolute top-5 left-5 px-3.5 py-1.5 rounded-full bg-[#040D08]/70 backdrop-blur-md border border-emerald-500/25 z-10">
                            <span className="text-[9px] font-bold text-emerald-300 uppercase tracking-widest font-mono">SCN-0{index + 1}</span>
                          </div>
                        </div>

                        {image && !isGenerating && (
                          <div className="bg-[#07170F]/95 border border-emerald-500/20 rounded-2xl p-4 space-y-4 shadow-xl relative z-10">
                             <div className="flex items-center justify-between pb-3 border-b border-emerald-500/15">
                                <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-300/80">Scene 0{index + 1}</span>
                                 <div className="flex items-center gap-2">
                                    <button 
                                      onClick={() => processImageForDownload(image, config.ratio).then(url => { const a = document.createElement('a'); a.href = url; a.download = `kontenkit-scene-${index+1}.png`; a.click(); })} 
                                      className="flex items-center gap-2 px-3 py-1.5 bg-emerald-500 text-black rounded-lg text-[10px] font-bold uppercase tracking-wide hover:bg-emerald-400 transition-colors cursor-pointer"
                                    >
                                      <Download className="w-3 h-3" /> Unduh Gambar
                                    </button>
                                 </div>
                             </div>

                             <div className="space-y-4 pt-1">
                                 <div className="bg-[#061810] border border-emerald-500/30 rounded-xl p-3.5 space-y-3 relative shadow-[0_0_20px_rgba(16,185,129,0.15)]">
                                    <div className="flex items-center gap-2">
                                      <Sparkles className="w-4 h-4 text-emerald-400" />
                                      <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-300">Revisi Visual AI</span>
                                    </div>
                                    <div className="relative group/input flex gap-2">
                                      <input 
                                        type="text" 
                                        disabled={isLoadingThis} 
                                        placeholder="Cth: Buat lebih terang, ubah angle, senyum..." 
                                        className={`flex-grow ${themeInputClass} rounded-lg pl-3 pr-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-400/40 shadow-lg transition-all disabled:opacity-50`} 
                                        value={scenePrompts[index] || ""} 
                                        onChange={(e) => setScenePrompts(prev => ({...prev, [index]: e.target.value}))} 
                                        onKeyDown={(e) => e.key === 'Enter' && regenerateSingleScene(index)} 
                                      />
                                      <button 
                                        type="button" 
                                        onClick={() => regenerateSingleScene(index)} 
                                        disabled={isLoadingThis || !scenePrompts[index] || cooldown > 0} 
                                        className={`px-4 rounded-lg text-[10px] font-bold uppercase tracking-widest bg-emerald-500 text-black hover:bg-emerald-400 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center shrink-0 cursor-pointer`}
                                      >
                                        {isLoadingThis ? <Loader2 className="w-4 h-4 animate-spin" /> : (cooldown > 0 ? `${cooldown}s` : "Revisi")}
                                      </button>
                                    </div>
                                 </div>

                                 <div className="bg-[#040D08]/90 p-3 rounded-lg border border-emerald-500/15 space-y-2 transition-all">
                                     <div className="flex items-center justify-between">
                                         <span className={`text-[9px] font-bold uppercase tracking-widest flex items-center gap-1.5 transition-colors ${sceneData.voActive ? 'text-emerald-400' : 'text-zinc-500'}`}>
                                             <Mic className="w-3 h-3"/> Voice Over {sceneData.voActive ? 'Aktif' : 'Nonaktif'}
                                         </span>
                                         <label className="relative inline-flex items-center cursor-pointer">
                                           <input 
                                               type="checkbox" 
                                               className="sr-only peer" 
                                               checked={sceneData.voActive || false} 
                                               onChange={(e) => updateSceneData(index, { voActive: e.target.checked })} 
                                               disabled={isLoadingThis} 
                                           />
                                           <div className="w-7 h-4 bg-zinc-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-emerald-500"></div>
                                         </label>
                                     </div>
                                     
                                     {sceneData.voActive ? (
                                         <div className="space-y-2">
                                             <textarea 
                                                 value={sceneData.voText || ""} 
                                                 onChange={(e) => updateSceneData(index, { voText: e.target.value })}
                                                 disabled={isLoadingThis}
                                                 className={`w-full ${themeInputClass} rounded-md p-2 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-400/30 transition-all resize-none h-16 custom-scrollbar`}
                                                 placeholder="Ketik naskah Voice Over di sini..."
                                             />
                                             <div className="flex items-center gap-2">
                                                 <button 
                                                      onClick={() => regenerateSingleScene(index, sceneData.voText)}
                                                     disabled={isLoadingThis}
                                                     className="flex-grow py-1.5 bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 rounded-lg text-[9px] font-bold uppercase tracking-widest hover:bg-emerald-500 hover:text-black transition-all disabled:opacity-50 cursor-pointer"
                                                 >
                                                     {isLoadingThis ? <Loader2 className="w-3 h-3 animate-spin mx-auto" /> : (cooldown > 0 ? `Tunggu ${cooldown}s` : "Update Prompt Voice Over")}
                                                 </button>
                                             </div>
                                         </div>
                                     ) : (
                                         <div className="flex items-center justify-center py-2 bg-[#040D08]/50 rounded-md border border-emerald-500/10 border-dashed">
                                             <p className="text-[10px] text-zinc-500 font-medium italic">Tanpa Voice Over (Hanya Musik / Ambient)</p>
                                         </div>
                                     )}
                                 </div>
                             </div>

                              <div className="flex gap-2">
                                  <button 
                                      type="button" 
                                      onClick={() => handleCopyPrompt(index)} 
                                      className={`flex-grow py-2.5 border text-[10px] font-bold uppercase tracking-widest rounded-lg transition-all flex items-center justify-center gap-2 group/copy cursor-pointer ${copiedStates[index] ? 'bg-emerald-500/20 border-emerald-400/50 text-emerald-300' : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20'}`}
                                  >
                                      {copiedStates[index] ? (
                                          <><CheckCircle2 className="w-3.5 h-3.5" /> Tersalin ke Clipboard</>
                                      ) : (
                                          <><Copy className="w-3.5 h-3.5" /> Salin Prompt Scene</>
                                      )}
                                  </button>
                              </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {!isGenerating && (
                  <div className="mt-20 flex flex-col items-center gap-8">
                    <div className="flex flex-col md:flex-row items-center gap-5">
                      <motion.button 
                        whileHover={{ scale: 1.03, y: -2 }}
                        whileTap={{ scale: 0.97 }}
                        onClick={handleDownloadAll} 
                        className="group flex items-center justify-center gap-3.5 px-9 py-4.5 bg-emerald-500 text-black rounded-full text-xs font-bold tracking-[0.25em] uppercase transition-all shadow-[0_15px_35px_-10px_rgba(16,185,129,0.4)] min-w-[270px] hover:bg-emerald-400 cursor-pointer"
                      >
                        <Download className="w-4 h-4 group-hover:rotate-12 transition-transform" /> 
                        Simpan Semua Scene
                      </motion.button>

                      <motion.button 
                        whileHover={{ scale: 1.03, y: -2 }}
                        whileTap={{ scale: 0.97 }}
                        onClick={() => setShowVideoGenerators(!showVideoGenerators)} 
                        className={`group flex items-center justify-center gap-3.5 px-9 py-4.5 border rounded-full text-xs font-bold tracking-[0.25em] uppercase transition-all min-w-[270px] cursor-pointer ${showVideoGenerators ? 'bg-emerald-500 text-black border-emerald-400 shadow-[0_15px_35px_rgba(16,185,129,0.3)]' : 'bg-[#07170F] border-emerald-500/30 text-emerald-100 hover:border-emerald-400/60 hover:bg-[#0A2216]'}`}
                      >
                        <Video className="w-4 h-4 text-emerald-400 group-hover:scale-110 transition-transform" /> 
                        Render Video AI
                      </motion.button>
                    </div>

                    {showVideoGenerators && (
                      <div className="flex flex-col items-center gap-5 w-full max-w-xl pb-12 animate-in fade-in slide-in-from-bottom-2">
                        <div className="flex items-center gap-4 w-full">
                           <div className="h-px flex-grow bg-emerald-500/15"></div>
                           <span className="text-[9px] font-bold uppercase tracking-[0.25em] text-emerald-400/70">External Video Engines</span>
                           <div className="h-px flex-grow bg-emerald-500/15"></div>
                        </div>
                        <div className="grid grid-cols-3 gap-3.5 w-full">
                          {[
                            { name: 'Meta AI', url: 'https://www.meta.ai/' },
                            { name: 'Grok AI', url: 'https://grok.com/' },
                            { name: 'Flow AI', url: 'https://labs.google/fx/tools/flow' }
                          ].map(ai => (
                            <a 
                              key={ai.name} 
                              href={ai.url} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="flex flex-col items-center gap-2 p-4 bg-[#07170F] border border-emerald-500/20 rounded-2xl hover:border-emerald-400/40 hover:bg-[#0A2216] transition-all text-[9px] font-bold uppercase tracking-wider text-emerald-300 hover:text-white text-center shadow-lg"
                            >
                              {ai.name}
                            </a>
                          ))}
                        </div>
                        
                        <motion.button 
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={handleCopyAllPrompts}
                          className="flex items-center gap-2.5 px-6 py-3 bg-[#07170F] border border-emerald-500/30 text-emerald-400 rounded-xl text-[10px] font-bold uppercase tracking-wider hover:bg-emerald-500/15 transition-all cursor-pointer"
                        >
                          <Copy className="w-3.5 h-3.5" /> Salin Semua Prompt Video
                        </motion.button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {previewImage && (
              <div className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center p-4 md:p-12 animate-in fade-in duration-200" onClick={() => setPreviewImage(null)}>
                <div 
                  className={`
                    relative overflow-hidden rounded-2xl shadow-2xl transition-all flex items-center justify-center bg-[#07170F] border border-emerald-500/30
                    ${config.ratio === '9:16' ? 'aspect-[9/16] h-full max-h-[90vh] w-auto' : ''}
                    ${config.ratio === '16:9' ? 'aspect-[16/9] w-full max-w-[90vw] h-auto' : ''}
                    ${config.ratio === '1:1' ? 'aspect-square h-full max-h-[90vh] w-auto' : ''}
                  `}
                  onClick={(e) => e.stopPropagation()}
                >
                   <img src={previewImage} alt="Full Preview" className={`w-full h-full object-cover ${config.ratio === '16:9' ? 'object-center' : 'object-top'}`} referrerPolicy="no-referrer" />
                  <button type="button" onClick={() => setPreviewImage(null)} className="absolute top-4 right-4 p-2 bg-[#040D08]/80 hover:bg-emerald-500 hover:text-black rounded-full text-emerald-300 transition-colors backdrop-blur-md border border-emerald-500/30 z-20 cursor-pointer">
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>
            )}
          </LayoutWrapper>
        );

      default: return null;
    }
  };

  return (
    <>
      {renderContent()}
    </>
  );
}
