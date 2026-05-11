/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { 
  Download, 
  Plus, 
  Trash2, 
  Image as ImageIcon, 
  Video,
  FileJson, 
  FileSpreadsheet,
  MousePointer2,
  Square,
  Type,
  X,
  BarChart3,
  Layout,
  Maximize2,
  ChevronLeft,
  ChevronDown,
  Upload,
  Archive,
  Loader2,
  Sparkles,
  Zap,
  ZapOff,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Bookmark,
  Save,
  Play,
  CheckCircle2,
  Circle,
  Edit2,
  RefreshCw
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "@/lib/utils";
import JSZip from 'jszip';
import Tesseract from 'tesseract.js';
import { DEMO_DATA } from './constants';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Cell
} from 'recharts';

interface Point {
  x: number;
  y: number;
}

interface Label {
  id: string;
  x: number; // percentage 0-100
  y: number; // percentage 0-100
  width: number; // percentage 0-100
  height: number; // percentage 0-100
  text: string;
  verified?: boolean;
}

interface Mask {
  id: string;
  name: string;
  boxes: Omit<Label, 'id'>[];
}

interface VideoTask {
  id: string;
  timestamp: number;
  thumbnail: string;
  labels: Label[];
}

type ViewMode = 'editor' | 'stats' | 'export';

export default function App() {
  const [viewMode, setViewMode] = useState<ViewMode>('editor');
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isExportingZip, setIsExportingZip] = useState(false);
  const [augBlur, setAugBlur] = useState(0);
  const [augPerspectiveX, setAugPerspectiveX] = useState(0);
  const [augPerspectiveY, setAugPerspectiveY] = useState(0);
  const [augStretch, setAugStretch] = useState(false);
  const [augLockAspectRatio, setAugLockAspectRatio] = useState(false);
  const [randomSeed, setRandomSeed] = useState(0);
  
  // Batch Export Augmentation Settings
  const [enableBatchBlur, setEnableBatchBlur] = useState(false);
  const [batchBlurMin, setBatchBlurMin] = useState(0);
  const [batchBlurMax, setBatchBlurMax] = useState(20);
  const [batchBlurSteps, setBatchBlurSteps] = useState(2);
  
  const [enableBatchPerspX, setEnableBatchPerspX] = useState(false);
  const [batchPerspXMin, setBatchPerspXMin] = useState(-15);
  const [batchPerspXMax, setBatchPerspXMax] = useState(15);
  const [batchPerspXSteps, setBatchPerspXSteps] = useState(2);
  
  const [enableBatchPerspY, setEnableBatchPerspY] = useState(false);
  const [batchPerspYMin, setBatchPerspYMin] = useState(-15);
  const [batchPerspYMax, setBatchPerspYMax] = useState(15);
  const [batchPerspYSteps, setBatchPerspYSteps] = useState(2);

  const [isAiMode, setIsAiMode] = useState(false);
  const [isOcrLoading, setIsOcrLoading] = useState(false);
  const [isRecollecting, setIsRecollecting] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [imageUrl, setImageUrl] = useState<string>("");
  const [activeImageUrl, setActiveImageUrl] = useState<string | null>(null);
  const [labels, setLabels] = useState<Label[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPoint, setStartPoint] = useState<Point | null>(null);
  const [currentBox, setCurrentBox] = useState<Label | null>(null);
  const [editingLabelId, setEditingLabelId] = useState<string | null>(null);
  const [savedMasks, setSavedMasks] = useState<Mask[]>([]);
  const [renamingMaskId, setRenamingMaskId] = useState<string | null>(null);
  const [renamingMaskName, setRenamingMaskName] = useState("");
  const [isMasksExpanded, setIsMasksExpanded] = useState(false);
  const [isLeftSidebarOpen, setIsLeftSidebarOpen] = useState(true);
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  
  // Video related state
  type VideoWorkflowMode = 'selection' | 'labeling';
  const [videoUrl, setVideoUrl] = useState<string | null>("https://i.imgur.com/YElCfgj.mp4");
  const [videoWorkflowMode, setVideoWorkflowMode] = useState<VideoWorkflowMode>('selection');
  const [videoTasks, setVideoTasks] = useState<VideoTask[]>([]);
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const loadDemoProject = () => {
    setVideoUrl(DEMO_DATA.videoUrl);
    setVideoWorkflowMode('selection');
    setVideoTasks(DEMO_DATA.videoTasks as any);
    setActiveTaskId(null);
    setIsRecollecting(true);
    setLabels([]);
    setActiveImageUrl(null);
  };

  // Automated frame recollection for demo project
  useEffect(() => {
    if (!isRecollecting || !videoUrl) return;

    const recover = async () => {
      // Poll for videoRef.current if it's not ready (component mounting)
      let video = videoRef.current;
      let attempts = 0;
      while (!video && attempts < 20) {
        await new Promise(r => setTimeout(r, 100));
        video = videoRef.current;
        attempts++;
      }

      if (!video) {
        console.error("Video element not found after polling");
        setIsRecollecting(false);
        return;
      }
        
      // Wait for metadata
      if (video.readyState < 1) {
        await new Promise(resolve => {
          if (video) video.onloadedmetadata = resolve;
        });
      }

      const updatedTasks = [...videoTasks];
      for (let i = 0; i < updatedTasks.length; i++) {
        const task = updatedTasks[i];
        video.currentTime = task.timestamp;
        
        await new Promise(resolve => {
          const onSeeked = () => {
            if (video) video.removeEventListener('seeked', onSeeked);
            // Small delay to ensure frame is rendered
            setTimeout(resolve, 100);
          };
          video.addEventListener('seeked', onSeeked);
        });

        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          task.thumbnail = canvas.toDataURL('image/jpeg', 0.8);
        }
      }

      setVideoTasks(updatedTasks);
      setIsRecollecting(false);
      setVideoWorkflowMode('labeling');
      
      const demoActiveTaskId = DEMO_DATA.activeTaskId;
      const activeTask = updatedTasks.find(t => t.id === demoActiveTaskId) || updatedTasks[0];
      
      if (activeTask) {
        setActiveTaskId(activeTask.id);
        setActiveImageUrl(activeTask.thumbnail);
        setLabels(activeTask.labels);
        setImageSize(DEMO_DATA.image_size);
      }
    };
    
    recover().catch(err => {
      console.error("Failed to recollect demo frames", err);
      setIsRecollecting(false);
    });
  }, [isRecollecting, videoUrl]);

  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const maskInputRef = useRef<HTMLInputElement>(null);

  // Load masks from localStorage
  useEffect(() => {
    const stored = localStorage.getItem('ocr_masks');
    if (stored) {
      try {
        setSavedMasks(JSON.parse(stored));
      } catch (e) {
        console.error("Failed to load masks", e);
      }
    }
  }, []);

  // Save masks to localStorage
  useEffect(() => {
    localStorage.setItem('ocr_masks', JSON.stringify(savedMasks));
  }, [savedMasks]);

  // Sync labels with video tasks
  useEffect(() => {
    if (activeTaskId && videoUrl) {
      setVideoTasks(prev => prev.map(t => t.id === activeTaskId ? { ...t, labels } : t));
    }
  }, [labels, activeTaskId, videoUrl]);

  const sampledCrops = useMemo(() => {
    const crops: { task: VideoTask; label: Label }[] = [];
    videoTasks.forEach(task => {
      task.labels.forEach(label => {
        crops.push({ task, label });
      });
    });
    // If no video tasks, check current labels
    if (crops.length === 0 && activeImageUrl && labels.length > 0) {
      labels.forEach(label => {
        crops.push({ 
          task: { id: 'current', timestamp: 0, thumbnail: activeImageUrl, labels: [] }, 
          label 
        });
      });
    }
    return crops.sort(() => 0.5 - Math.random()).slice(0, 9);
  }, [videoTasks, activeImageUrl, labels, randomSeed]);

  // Dark mode effect
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  const saveCurrentAsMask = () => {
    if (labels.length === 0) return;

    const newMask: Mask = {
      id: crypto.randomUUID(),
      name: `Mask ${savedMasks.length + 1}`,
      boxes: labels.map(({ x, y, width, height, text }) => ({ x, y, width, height, text }))
    };

    setSavedMasks([...savedMasks, newMask]);
  };

  const applyMask = async (mask: Mask) => {
    if (!activeImageUrl) return;
    
    // Clear existing labels when applying a mask for a clean template start
    const newLabels: Label[] = mask.boxes.map(box => ({
      ...box,
      id: crypto.randomUUID(),
      verified: false
    }));

    setLabels(newLabels);

    // Auto-apply OCR to each new label if AI mode is on
    if (isAiMode) {
      for (const label of newLabels) {
        await performOCR(label);
      }
    }
  };

  const deleteMask = (id: string) => {
    setSavedMasks(savedMasks.filter(m => m.id !== id));
  };

  const startRenaming = (mask: Mask) => {
    setRenamingMaskId(mask.id);
    setRenamingMaskName(mask.name);
  };

  const submitRename = () => {
    if (renamingMaskId && renamingMaskName.trim()) {
      setSavedMasks(savedMasks.map(m => 
        m.id === renamingMaskId ? { ...m, name: renamingMaskName.trim() } : m
      ));
    }
    setRenamingMaskId(null);
    setRenamingMaskName("");
  };

  const exportMask = (mask: Mask) => {
    const blob = new Blob([JSON.stringify(mask, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `mask_${mask.name.replace(/\s+/g, '_')}.json`;
    link.click();
  };

  const exportAllMasks = () => {
    if (savedMasks.length === 0) return;
    const blob = new Blob([JSON.stringify(savedMasks, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `all_masks_${Date.now()}.json`;
    link.click();
  };

  const handleImportMask = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target?.result as string);
        if (Array.isArray(data)) {
          // Bulk import
          const newMasks = data.filter(m => m.boxes && Array.isArray(m.boxes)).map(m => ({
            ...m,
            id: m.id || crypto.randomUUID(),
            name: m.name || `Imported Mask ${savedMasks.length + 1}`
          }));
          setSavedMasks([...savedMasks, ...newMasks]);
        } else if (data.boxes && Array.isArray(data.boxes)) {
          // Single import
          const newMask: Mask = {
            id: crypto.randomUUID(),
            name: data.name || `Imported Mask ${savedMasks.length + 1}`,
            boxes: data.boxes
          };
          setSavedMasks([...savedMasks, newMask]);
        }
      } catch (err) {
        console.error("Failed to parse Mask JSON", err);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleImportJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target?.result as string);
        
        if (data.videoUrl !== undefined) {
          // New format with video support
          setVideoUrl(data.videoUrl);
          setVideoWorkflowMode(data.videoWorkflowMode || 'selection');
          setVideoTasks(data.videoTasks || []);
          setActiveTaskId(data.activeTaskId || null);
          setActiveImageUrl(data.activeImageUrl || null);
          setImageUrl(data.videoUrl || data.activeImageUrl || "");
          
          if (data.labels && Array.isArray(data.labels)) {
            const w = data.image_size?.width || 100;
            const h = data.image_size?.height || 100;
            const newLabels: Label[] = data.labels.map((l: any) => {
              const [x1, y1, x2, y2] = l.box_2d;
              return {
                id: crypto.randomUUID(),
                x: (x1 / w) * 100,
                y: (y1 / h) * 100,
                width: ((x2 - x1) / w) * 100,
                height: ((y2 - y1) / h) * 100,
                text: l.text || "",
                verified: l.verified || false
              };
            });
            setLabels(newLabels);
          }
          return;
        }

        if (data.labels && Array.isArray(data.labels)) {
          // We need image size to map pixels back to percentages
          // If imageSize is not set yet, we use the one from JSON
          const w = data.image_size?.width || imageSize.width || 100;
          const h = data.image_size?.height || imageSize.height || 100;

          const newLabels: Label[] = data.labels.map((l: any) => {
            const [x1, y1, x2, y2] = l.box_2d;
            return {
              id: crypto.randomUUID(),
              x: (x1 / w) * 100,
              y: (y1 / h) * 100,
              width: ((x2 - x1) / w) * 100,
              height: ((y2 - y1) / h) * 100,
              text: l.text || ""
            };
          });
          
          setLabels(newLabels);
          if (data.image_size) {
            setImageSize(data.image_size);
          }
          
          if (data.image_url) {
            setActiveImageUrl(data.image_url);
            setImageUrl(data.image_url);
          }
        }
      } catch (err) {
        console.error("Failed to parse JSON", err);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const exportDatasetZip = async (mode: 'current' | 'all' = 'current') => {
    if (mode === 'current' && (!activeImageUrl || labels.length === 0)) return;
    if (mode === 'all' && videoTasks.length === 0 && labels.length === 0) return;
    
    setIsExportingZip(true);

    try {
      const zip = new JSZip();
      const imagesFolder = zip.folder("images");
      let labelsText = "";

      // Determine what to export
      const tasksToExport = mode === 'current' 
        ? [{ imageUrl: activeImageUrl!, labels, id: activeTaskId || 'current' }] 
        : (videoTasks.length > 0 
            ? videoTasks.map(t => ({ imageUrl: t.thumbnail, labels: t.labels, id: t.id }))
            : [{ imageUrl: activeImageUrl!, labels, id: activeTaskId || 'current' }]);

      for (const task of tasksToExport) {
        if (!task.imageUrl || task.labels.length === 0) continue;

        // Fetch image
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.src = task.imageUrl;

        await new Promise((resolve, reject) => {
          img.onload = resolve;
          img.onerror = () => reject(new Error(`Failed to load image for task ${task.id}. This might be a CORS issue.`));
        });

        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error("Could not get canvas context");

        const taskWidth = img.naturalWidth;
        const taskHeight = img.naturalHeight;

        // Generate augmentation values
        const getSteps = (min: number, max: number, steps: number) => {
          if (steps <= 1) return [min];
          const values = [];
          for (let i = 0; i < steps; i++) {
            values.push(min + (max - min) * (i / (steps - 1)));
          }
          return values;
        };

        const blurValues = enableBatchBlur ? getSteps(batchBlurMin, batchBlurMax, batchBlurSteps) : [0];
        const perspXValues = enableBatchPerspX ? getSteps(batchPerspXMin, batchPerspXMax, batchPerspXSteps) : [0];
        const perspYValues = enableBatchPerspY ? getSteps(batchPerspYMin, batchPerspYMax, batchPerspYSteps) : [0];

        for (let i = 0; i < task.labels.length; i++) {
          const label = task.labels[i];
          const x = (label.x / 100) * taskWidth;
          const y = (label.y / 100) * taskHeight;
          const w = (label.width / 100) * taskWidth;
          const h = (label.height / 100) * taskHeight;

          if (w <= 0 || h <= 0) continue;

          canvas.width = w;
          canvas.height = h;

          const basename = task.imageUrl.startsWith('data:') 
            ? `task_${task.id.substring(0, 8)}`
            : task.imageUrl.split('/').pop()?.split('?')[0].split('#')[0] || 'image';
          const nameWithoutExt = basename.replace(/\.[^/.]+$/, "");
          const sanitizedText = label.text.trim().replace(/[^a-z0-9]/gi, '_').toLowerCase() || 'unlabeled';

          // Nested loops for augmentations
          for (const bVal of blurValues) {
            for (const pxVal of perspXValues) {
              for (const pyVal of perspYValues) {
                ctx.clearRect(0, 0, w, h);
                ctx.save();
                
                if (bVal > 0) ctx.filter = `blur(${bVal / 10}px)`;
                
                // Perspective approximation
                const radX = (pxVal * Math.PI) / 180;
                const radY = (pyVal * Math.PI) / 180;
                ctx.translate(w / 2, h / 2);
                ctx.transform(Math.cos(radX), Math.sin(radX) * 0.1, Math.sin(radY) * 0.1, Math.cos(radY), 0, 0);
                ctx.translate(-w / 2, -h / 2);

                ctx.drawImage(img, x, y, w, h, 0, 0, w, h);
                ctx.restore();

                const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.9));
                if (blob) {
                  const filename = `${nameWithoutExt}_BLUR${Math.round(bVal)}_PERX${Math.round(pxVal)}_PERY${Math.round(pyVal)}__${sanitizedText.substring(0, 30)}.jpg`;
                  imagesFolder?.file(filename, blob);
                  labelsText += `images/${filename} ${label.text}\n`;
                }
              }
            }
          }
        }
      }

      zip.file("labels.txt", labelsText);
      const content = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(content);
      const link = document.createElement('a');
      link.href = url;
      link.download = `easyocr_dataset_${mode}_${Date.now()}.zip`;
      link.click();
    } catch (error) {
      console.error("Export failed:", error);
      const msg = error instanceof Error ? error.message : "Unknown error";
      alert(`Export failed: ${msg}\n\nNote: External images may block cropping via canvas due to CORS. Data URLs (captured frames) should work fine.`);
    } finally {
      setIsExportingZip(false);
    }
  };

  // Analysis Logic
  const analysis = useMemo(() => {
    // Aggregate all labels from all video tasks if they exist, otherwise use current labels
    const allLabels = videoTasks.length > 0 
      ? videoTasks.flatMap(t => t.labels)
      : labels;

    const allText = allLabels.map(l => l.text).join('').toUpperCase();
    const charCounts: Record<string, number> = {};
    
    // Target sets
    const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
    const numbers = "0123456789".split("");
    const targetSet = [...letters, ...numbers];

    targetSet.forEach(char => charCounts[char] = 0);
    
    for (const char of allText) {
      if (charCounts[char] !== undefined) {
        charCounts[char]++;
      }
    }

    const chartData = targetSet.map(char => ({
      name: char,
      count: charCounts[char],
      type: numbers.includes(char) ? 'number' : 'letter'
    }));

    const missing = targetSet.filter(char => charCounts[char] === 0);
    const present = targetSet.filter(char => charCounts[char] > 0);
    const coverage = (present.length / targetSet.length) * 100;

    return { charCounts, chartData, missing, coverage, totalChars: allText.length, totalLabels: allLabels.length };
  }, [labels, videoTasks]);

  // Handle image load to get natural dimensions
  const onImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    setImageSize({ width: img.naturalWidth, height: img.naturalHeight });
  };

  // Update container size for coordinate mapping
  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        setContainerSize({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight,
        });
      }
    };
    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, [activeImageUrl, viewMode]);

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setZoom(1);
        setEditingLabelId(null);
        setIsFullscreen(false);
      }
      if (e.key.toLowerCase() === 'n') {
        setIsDarkMode(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleZoomIn = () => setZoom(prev => Math.min(prev + 0.2, 5));
  const handleZoomOut = () => setZoom(prev => Math.max(prev - 0.2, 0.5));
  const resetZoom = () => setZoom(1);

  const handleDoubleClick = (e: React.MouseEvent) => {
    const coords = getRelativeCoords(e);
    // Find the label under the cursor (reverse to get the top-most one)
    const clickedLabel = [...labels].reverse().find(l => 
      coords.x >= l.x && coords.x <= l.x + l.width &&
      coords.y >= l.y && coords.y <= l.y + l.height
    );
    if (clickedLabel) {
      toggleVerifyLabel(clickedLabel.id);
    }
  };

  const getRelativeCoords = (e: React.MouseEvent | React.TouchEvent): Point => {
    if (!containerRef.current) return { x: 0, y: 0 };
    const rect = containerRef.current.getBoundingClientRect();
    
    let clientX, clientY;
    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    return {
      x: ((clientX - rect.left) / rect.width) * 100,
      y: ((clientY - rect.top) / rect.height) * 100,
    };
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!activeImageUrl || editingLabelId) return;
    const coords = getRelativeCoords(e);
    setIsDrawing(true);
    setStartPoint(coords);
    const newId = crypto.randomUUID();
    setCurrentBox({
      id: newId,
      x: coords.x,
      y: coords.y,
      width: 0,
      height: 0,
      text: "",
    });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDrawing || !startPoint || !currentBox) return;
    const coords = getRelativeCoords(e);
    
    setCurrentBox({
      ...currentBox,
      x: Math.min(startPoint.x, coords.x),
      y: Math.min(startPoint.y, coords.y),
      width: Math.abs(coords.x - startPoint.x),
      height: Math.abs(coords.y - startPoint.y),
    });
  };

  const handleMouseUp = () => {
    if (!isDrawing || !currentBox) return;
    if (currentBox.width > 0.5 && currentBox.height > 0.5) {
      const newLabel = { ...currentBox };
      setLabels([...labels, newLabel]);
      setEditingLabelId(newLabel.id);
      if (isAiMode) {
        performOCR(newLabel);
      }
    }
    setIsDrawing(false);
    setStartPoint(null);
    setCurrentBox(null);
  };

  const performOCR = async (label: Label) => {
    if (!activeImageUrl || !isAiMode) return;
    setIsOcrLoading(true);
    try {
      const x = (label.x / 100) * imageSize.width;
      const y = (label.y / 100) * imageSize.height;
      const w = (label.width / 100) * imageSize.width;
      const h = (label.height / 100) * imageSize.height;

      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const img = new Image();
      img.crossOrigin = "anonymous";
      img.src = activeImageUrl;

      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = () => reject(new Error("Failed to load image for OCR. CORS issue?"));
      });

      canvas.width = w;
      canvas.height = h;
      ctx.drawImage(img, x, y, w, h, 0, 0, w, h);

      const { data: { text } } = await Tesseract.recognize(canvas, 'eng');
      const cleanedText = text.trim();
      
      setLabels(prev => prev.map(l => l.id === label.id ? { ...l, text: cleanedText } : l));
    } catch (error) {
      console.error("OCR failed:", error);
    } finally {
      setIsOcrLoading(false);
    }
  };

  const deleteLabel = (id: string) => {
    setLabels(labels.filter(l => l.id !== id));
    if (editingLabelId === id) setEditingLabelId(null);
  };

  const captureFrame = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const thumbnail = canvas.toDataURL('image/jpeg', 0.8);
    
    const newTask: VideoTask = {
      id: crypto.randomUUID(),
      timestamp: video.currentTime,
      thumbnail,
      labels: []
    };
    
    setVideoTasks([...videoTasks, newTask]);
    selectVideoTask(newTask);
  };

  const selectVideoTask = (task: VideoTask) => {
    // Save current labels to the active task before switching
    if (activeTaskId) {
      setVideoTasks(prev => prev.map(t => t.id === activeTaskId ? { ...t, labels } : t));
    }
    
    setActiveTaskId(task.id);
    setActiveImageUrl(task.thumbnail);
    setLabels(task.labels);
  };

  const deleteVideoTask = (id: string) => {
    setVideoTasks(videoTasks.filter(t => t.id !== id));
    if (activeTaskId === id) {
      setActiveTaskId(null);
      setActiveImageUrl(null);
      setLabels([]);
    }
  };

  const updateLabelText = (id: string, text: string) => {
    setLabels(labels.map(l => l.id === id ? { ...l, text } : l));
  };

  const toggleVerifyLabel = (id: string) => {
    setLabels(labels.map(l => l.id === id ? { ...l, verified: !l.verified } : l));
  };

  const exportCSV = () => {
    if (!activeImageUrl) return;
    const filename = activeImageUrl.split('/').pop() || 'image.jpg';
    
    // EasyOCR Format: filename, x1, y1, x2, y2, x3, y3, x4, y4, text
    // We map percentages back to pixels
    const rows = labels.map(l => {
      const x1 = Math.round((l.x / 100) * imageSize.width);
      const y1 = Math.round((l.y / 100) * imageSize.height);
      const x2 = Math.round(((l.x + l.width) / 100) * imageSize.width);
      const y2 = y1;
      const x3 = x2;
      const y3 = Math.round(((l.y + l.height) / 100) * imageSize.height);
      const x4 = x1;
      const y4 = y3;
      return `${filename},${x1},${y1},${x2},${y2},${x3},${y3},${x4},${y4},"${l.text.replace(/"/g, '""')}"`;
    });

    const csvContent = "filename,x1,y1,x2,y2,x3,y3,x4,y4,text\n" + rows.join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `labels_${Date.now()}.csv`;
    link.click();
  };

  const exportJSON = () => {
    const filename = activeImageUrl ? (activeImageUrl.split('/').pop() || 'image.jpg') : 'project.json';
    
    const data = {
      version: "2.0",
      videoUrl,
      videoWorkflowMode,
      videoTasks,
      activeTaskId,
      activeImageUrl,
      image_size: imageSize,
      labels: labels.map(l => ({
        text: l.text,
        verified: l.verified,
        box_2d: [
          Math.round((l.x / 100) * imageSize.width),
          Math.round((l.y / 100) * imageSize.height),
          Math.round(((l.x + l.width) / 100) * imageSize.width),
          Math.round(((l.y + l.height) / 100) * imageSize.height)
        ],
        points: [
          [Math.round((l.x / 100) * imageSize.width), Math.round((l.y / 100) * imageSize.height)],
          [Math.round(((l.x + l.width) / 100) * imageSize.width), Math.round((l.y / 100) * imageSize.height)],
          [Math.round(((l.x + l.width) / 100) * imageSize.width), Math.round(((l.y + l.height) / 100) * imageSize.height)],
          [Math.round((l.x / 100) * imageSize.width), Math.round(((l.y + l.height) / 100) * imageSize.height)]
        ]
      }))
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `labels_${Date.now()}.json`;
    link.click();
  };

  // Sync labels to active video task
  useEffect(() => {
    if (activeTaskId) {
      setVideoTasks(prev => prev.map(t => t.id === activeTaskId ? { ...t, labels } : t));
    }
  }, [labels, activeTaskId]);

  const handleUrlSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (imageUrl) {
      const isVideo = /\.(mp4|webm|ogg|mov)(\?.*)?$/i.test(imageUrl);
      if (isVideo) {
        setVideoUrl(imageUrl);
        setVideoWorkflowMode('selection');
        setActiveImageUrl(null);
        setVideoTasks([]);
        setActiveTaskId(null);
      } else {
        setVideoUrl(null);
        setActiveImageUrl(imageUrl);
        setVideoTasks([]);
        setActiveTaskId(null);
      }
      setLabels([]);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col font-sans text-text-main">
      {/* Header */}
      <header className="h-16 border-b border-border bg-card flex items-center justify-between px-6 sticky top-0 z-50">
        <div className="flex items-center gap-6">
          <div className="text-accent font-extrabold text-xl flex items-center gap-2">
            <span className="text-2xl">◈</span>
            <h1 className="tracking-tight">OCR Annotator</h1>
          </div>
          
          <nav className="flex items-center gap-1 bg-muted p-1 rounded-lg">
            <button 
              onClick={() => setViewMode('editor')}
              className={cn(
                "flex items-center gap-2 px-3 py-1.5 text-xs font-bold rounded-md transition-all",
                viewMode === 'editor' ? "bg-card text-accent shadow-sm" : "text-text-muted hover:text-text-main"
              )}
            >
              <Layout className="w-3.5 h-3.5" />
              Editor
            </button>
            <button 
              onClick={() => setViewMode('stats')}
              className={cn(
                "flex items-center gap-2 px-3 py-1.5 text-xs font-bold rounded-md transition-all",
                viewMode === 'stats' ? "bg-card text-accent shadow-sm" : "text-text-muted hover:text-text-main"
              )}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              Analysis
            </button>
            <button 
              onClick={() => setViewMode('export')}
              className={cn(
                "flex items-center gap-2 px-3 py-1.5 text-xs font-bold rounded-md transition-all",
                viewMode === 'export' ? "bg-card text-accent shadow-sm" : "text-text-muted hover:text-text-main"
              )}
            >
              <Archive className="w-3.5 h-3.5" />
              Export
            </button>
          </nav>

          {videoUrl && (
            <nav className="flex items-center gap-1 bg-muted p-1 rounded-lg ml-4">
              <button 
                onClick={() => setVideoWorkflowMode('selection')}
                className={cn(
                  "flex items-center gap-2 px-3 py-1.5 text-xs font-bold rounded-md transition-all",
                  videoWorkflowMode === 'selection' ? "bg-card text-accent shadow-sm" : "text-text-muted hover:text-text-main"
                )}
              >
                <Video className="w-3.5 h-3.5" />
                Selection
              </button>
              <button 
                onClick={() => setVideoWorkflowMode('labeling')}
                className={cn(
                  "flex items-center gap-2 px-3 py-1.5 text-xs font-bold rounded-md transition-all",
                  videoWorkflowMode === 'labeling' ? "bg-card text-accent shadow-sm" : "text-text-muted hover:text-text-main"
                )}
              >
                <Edit2 className="w-3.5 h-3.5" />
                Labeling
              </button>
            </nav>
          )}

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsAiMode(!isAiMode)}
              className={cn(
                "flex items-center gap-2 px-3 py-1.5 text-xs font-bold rounded-md transition-all border",
                isAiMode 
                  ? "bg-accent/10 border-accent/20 text-accent shadow-sm" 
                  : "bg-muted border-border text-muted-foreground hover:text-foreground"
              )}
            >
              {isAiMode ? <Zap className="w-3.5 h-3.5 fill-current" /> : <ZapOff className="w-3.5 h-3.5" />}
              AI Mode {isAiMode ? "ON" : "OFF"}
            </button>
            {isOcrLoading && (
              <div className="flex items-center gap-1 text-[10px] font-bold text-amber-600 animate-pulse">
                <Loader2 className="w-3 h-3 animate-spin" />
                OCR...
              </div>
            )}
          </div>
        </div>

        {viewMode === 'editor' && (
          <div className="flex-1 max-w-[500px] mx-8">
            <form onSubmit={handleUrlSubmit} className="flex gap-2">
              <Input 
                placeholder="Enter Image URL..." 
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                className="h-9 text-sm border-border focus-visible:ring-accent"
              />
              <Button type="submit" size="sm" className="h-9 px-4 bg-accent hover:bg-accent/90 text-accent-foreground font-semibold rounded-md">
                Load Image
              </Button>
            </form>
          </div>
        )}

        <div className="flex items-center gap-3">
          {viewMode === 'editor' && activeImageUrl && (
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setIsFullscreen(true)}
              className="h-9 px-3 border-border text-text-muted hover:text-text-main font-semibold rounded-md"
              title="Full Page Preview"
            >
              <Maximize2 className="w-4 h-4" />
            </Button>
          )}
          {viewMode === 'editor' ? (
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => setLabels([])}
              disabled={labels.length === 0}
              className="h-9 px-4 bg-border hover:bg-border/80 text-text-main font-semibold rounded-md"
            >
              Clear All
            </Button>
          ) : (
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setViewMode('editor')}
              className="h-9 px-4 border-border text-text-main font-semibold rounded-md flex items-center gap-2"
            >
              <ChevronLeft className="w-4 h-4" />
              Back to Editor
            </Button>
          )}
          <div className="w-8 h-8 rounded-full bg-border"></div>
        </div>
      </header>

      <main className="flex-1 flex overflow-hidden">
        <AnimatePresence mode="wait">
          {viewMode === 'editor' ? (
            <motion.div 
              key="editor"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex-1 flex relative"
            >
              {/* Left Sidebar Toggle (Bookmark style) */}
              {!isLeftSidebarOpen && (
                <Button
                  variant="secondary"
                  size="icon"
                  onClick={() => setIsLeftSidebarOpen(true)}
                  className="absolute left-0 top-1/2 -translate-y-1/2 z-50 h-12 w-6 rounded-l-none rounded-r-md border border-l-0 border-border shadow-md bg-sidebar hover:bg-accent hover:text-accent-foreground transition-all"
                  title="Open Sidebar"
                >
                  <Bookmark className="w-3 h-3 fill-current" />
                </Button>
              )}

              {/* Left Sidebar */}
              <AnimatePresence>
                {isLeftSidebarOpen && (
                  <motion.aside 
                    initial={{ width: 0, opacity: 0 }}
                    animate={{ width: 280, opacity: 1 }}
                    exit={{ width: 0, opacity: 0 }}
                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                    className="border-r border-border bg-sidebar flex flex-col shrink-0 overflow-hidden relative"
                  >
                    <div className="flex-1 flex flex-col overflow-hidden w-[280px]">
                      <div className="p-4 border-b border-border flex items-center justify-between bg-muted/20">
                        <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Project Controls</span>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={() => setIsLeftSidebarOpen(false)}
                          className="h-6 w-6 text-text-muted hover:text-accent"
                        >
                          <ChevronLeft className="w-4 h-4" />
                        </Button>
                      </div>

                      <div className="p-4 border-b border-border bg-card space-y-2">
                        <div className="grid grid-cols-1 gap-2">
                          <Button 
                            variant="outline"
                            onClick={() => fileInputRef.current?.click()}
                            className="w-full border-border text-text-main hover:bg-muted font-bold h-9 rounded-md flex items-center justify-center gap-2 text-[11px]"
                          >
                            <Upload className="w-3.5 h-3.5" />
                            Import JSON
                          </Button>
                          <Button 
                            variant="outline"
                            onClick={loadDemoProject}
                            className="w-full border-blue-500/30 text-blue-500 hover:bg-blue-500/5 font-bold h-9 rounded-md flex items-center justify-center gap-2 text-[11px]"
                          >
                            <Zap className="w-3.5 h-3.5" />
                            Load Demo Project
                          </Button>
                          <Button 
                            className="w-full bg-accent hover:bg-accent/90 text-accent-foreground font-bold h-9 rounded-md text-[11px]"
                            disabled={labels.length === 0}
                          >
                            Save Project
                          </Button>
                        </div>
                      </div>

                      <ScrollArea className="flex-1">
                        <div className="flex flex-col">
                          {videoTasks.length > 0 && (
                            <div className="px-5 py-5 border-b border-border bg-muted/30">
                              <div className="flex items-center justify-between mb-3">
                                <h2 className="text-[12px] font-bold text-text-muted uppercase tracking-wider">
                                  Video Tasks ({videoTasks.length})
                                </h2>
                              </div>
                              <ScrollArea className="h-[180px]">
                                <div className="grid grid-cols-1 gap-2">
                                  {videoTasks.map((task) => (
                                    <div 
                                      key={task.id}
                                      onClick={() => {
                                        selectVideoTask(task);
                                        setVideoWorkflowMode('labeling');
                                      }}
                                      className={cn(
                                        "flex items-center gap-3 p-2 rounded-md border transition-all cursor-pointer group",
                                        activeTaskId === task.id 
                                          ? "bg-accent/10 border-accent shadow-sm" 
                                          : "bg-card border-border hover:border-accent/50"
                                      )}
                                    >
                                      <div className="relative w-16 h-10 bg-muted rounded overflow-hidden flex-shrink-0">
                                        <img src={task.thumbnail} className="w-full h-full object-cover" alt="Frame" />
                                        <div className="absolute bottom-0 right-0 bg-black/60 text-white text-[8px] px-1 font-mono">
                                          {task.timestamp.toFixed(1)}s
                                        </div>
                                      </div>
                                      <div className="flex-1 min-w-0">
                                        <span className="text-[11px] font-bold block truncate">
                                          Frame at {task.timestamp.toFixed(2)}s
                                        </span>
                                        <span className="text-[9px] text-text-muted block">
                                          {task.labels.length} annotations
                                        </span>
                                      </div>
                                      <Button 
                                        variant="ghost" 
                                        size="icon" 
                                        className="h-6 w-6 text-text-muted hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          deleteVideoTask(task.id);
                                        }}
                                      >
                                        <Trash2 className="w-3 h-3" />
                                      </Button>
                                    </div>
                                  ))}
                                </div>
                              </ScrollArea>
                            </div>
                          )}
                        </div>
                      </ScrollArea>

                      <div className="px-5 py-5 border-t border-border bg-muted/30">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2 cursor-pointer group/title" onClick={() => setIsMasksExpanded(!isMasksExpanded)}>
                            <h2 className="text-[12px] font-bold text-text-muted uppercase tracking-wider">
                              Saved Masks ({savedMasks.length})
                            </h2>
                            <motion.div
                              animate={{ rotate: isMasksExpanded ? 180 : 0 }}
                              transition={{ duration: 0.2 }}
                            >
                              <ChevronDown className={cn("w-4 h-4 text-text-muted transition-colors", isMasksExpanded ? "text-accent" : "group-hover/title:text-accent")} />
                            </motion.div>
                          </div>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-6 w-6 text-accent hover:bg-accent/10"
                            onClick={saveCurrentAsMask}
                            disabled={labels.length === 0}
                            title="Save current layout as mask"
                          >
                            <Bookmark className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                        
                        <ScrollArea className={cn("transition-all duration-300", isMasksExpanded ? "h-[250px]" : "h-[120px]")}>
                          <div className="space-y-1.5">
                            {savedMasks.length === 0 ? (
                              <div className="py-4 text-center">
                                <p className="text-[10px] text-text-muted italic">No masks saved</p>
                              </div>
                            ) : (
                              (isMasksExpanded ? savedMasks : savedMasks.slice(0, 3)).map((mask) => (
                                <div 
                                  key={mask.id}
                                  onDoubleClick={() => applyMask(mask)}
                                  className="flex items-center gap-2 p-2 rounded-md bg-card border border-border group hover:border-accent transition-all cursor-pointer"
                                >
                                  <div className="flex-1 min-w-0">
                                    {renamingMaskId === mask.id ? (
                                      <Input 
                                        autoFocus
                                        value={renamingMaskName}
                                        onChange={(e) => setRenamingMaskName(e.target.value)}
                                        onBlur={submitRename}
                                        onKeyDown={(e) => {
                                          if (e.key === 'Enter') submitRename();
                                          if (e.key === 'Escape') setRenamingMaskId(null);
                                        }}
                                        className="h-6 text-[11px] px-1 py-0 font-bold bg-white text-black"
                                        onClick={(e) => e.stopPropagation()}
                                      />
                                    ) : (
                                      <>
                                        <span className="text-[11px] font-bold block truncate">{mask.name}</span>
                                        <span className="text-[9px] text-text-muted block">{mask.boxes.length} areas</span>
                                      </>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Button 
                                      variant="ghost" 
                                      size="icon" 
                                      className="h-5 w-5 text-accent hover:text-accent/80"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        applyMask(mask);
                                      }}
                                      title="Apply Mask"
                                    >
                                      <Play className="w-3 h-3 fill-current" />
                                    </Button>
                                    <Button 
                                      variant="ghost" 
                                      size="icon" 
                                      className="h-5 w-5 text-text-muted hover:text-text-main"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        startRenaming(mask);
                                      }}
                                      title="Rename Mask"
                                    >
                                      <Edit2 className="w-3 h-3" />
                                    </Button>
                                    <Button 
                                      variant="ghost" 
                                      size="icon" 
                                      className="h-5 w-5 text-text-muted hover:text-text-main"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        exportMask(mask);
                                      }}
                                      title="Export Mask"
                                    >
                                      <Download className="w-3 h-3" />
                                    </Button>
                                    <Button 
                                      variant="ghost" 
                                      size="icon" 
                                      className="h-5 w-5 text-text-muted hover:text-red-500"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        deleteMask(mask.id);
                                      }}
                                      title="Delete Mask"
                                    >
                                      <Trash2 className="w-3 h-3" />
                                    </Button>
                                  </div>
                                </div>
                              ))
                            )}
                          </div>
                        </ScrollArea>

                        {isMasksExpanded && (
                          <motion.div
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="space-y-2"
                          >
                            <Button 
                              variant="outline" 
                              size="sm" 
                              onClick={saveCurrentAsMask}
                              disabled={labels.length === 0}
                              className="w-full mt-3 text-[11px] h-8 bg-card border-accent/20 text-accent hover:bg-accent/5 font-bold flex items-center justify-center gap-2"
                            >
                              <Save className="w-3.5 h-3.5" />
                              Save Current as Mask
                            </Button>

                            <div className="grid grid-cols-2 gap-2 mt-2">
                              <Button 
                                variant="outline" 
                                size="sm" 
                                onClick={() => maskInputRef.current?.click()}
                                className="text-[10px] h-7 bg-muted border-none hover:bg-muted/80 text-text-main font-bold flex items-center justify-center gap-1.5"
                              >
                                <Upload className="w-3 h-3" />
                                Import
                              </Button>
                              <input 
                                type="file" 
                                ref={maskInputRef} 
                                onChange={handleImportMask} 
                                accept=".json" 
                                className="hidden" 
                              />
                              <Button 
                                variant="outline" 
                                size="sm" 
                                onClick={exportAllMasks}
                                disabled={savedMasks.length === 0}
                                className="text-[10px] h-7 bg-muted border-none hover:bg-muted/80 text-text-main font-bold flex items-center justify-center gap-1.5"
                              >
                                <Download className="w-3 h-3" />
                                Export All
                              </Button>
                            </div>
                          </motion.div>
                        )}
                      </div>

                      <div className="p-5 border-t border-border bg-card">
                        <div className="grid grid-cols-2 gap-2 mb-2">
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={exportCSV} 
                            disabled={labels.length === 0}
                            className="text-[12px] h-9 bg-border border-none hover:bg-border/80 text-text-main font-semibold"
                          >
                            Export CSV
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={exportJSON} 
                            disabled={labels.length === 0}
                            className="text-[12px] h-9 bg-border border-none hover:bg-border/80 text-text-main font-semibold"
                          >
                            Export JSON
                          </Button>
                        </div>

                        <input 
                          type="file" 
                          ref={fileInputRef} 
                          onChange={handleImportJSON} 
                          accept=".json" 
                          className="hidden" 
                        />
                      </div>
                    </div>
                  </motion.aside>
                )}
              </AnimatePresence>

              {/* Canvas Area */}
              <div className="flex-1 bg-canvas-bg relative overflow-auto flex items-center justify-center p-6">
          {videoUrl && videoWorkflowMode === 'selection' ? (
             <div className="flex-1 flex flex-col p-8 overflow-y-auto h-full w-full">
                <div className="max-w-5xl mx-auto w-full space-y-8">
                  <div className="bg-card rounded-2xl overflow-hidden shadow-2xl aspect-video relative group border-4 border-border">
                    <video 
                      ref={videoRef}
                      src={videoUrl}
                      controls
                      className="w-full h-full"
                      crossOrigin="anonymous"
                    />
                    {isRecollecting && (
                      <div className="absolute inset-0 bg-background/80 flex flex-col items-center justify-center gap-4 z-50">
                        <Loader2 className="w-12 h-12 text-accent animate-spin" />
                        <div className="text-xl font-bold text-text-main animate-pulse">
                          Recollecting frames from URL...
                        </div>
                        <p className="text-sm text-text-muted">
                          Seeking precise timestamps for the demo project
                        </p>
                      </div>
                    )}
                    <div className="absolute top-6 right-6 opacity-0 group-hover:opacity-100 transition-opacity">
                       <Button 
                        onClick={captureFrame}
                        size="lg"
                        className="bg-accent hover:bg-accent/90 text-accent-foreground font-bold shadow-2xl scale-110"
                      >
                        <Plus className="w-5 h-5 mr-2" />
                        Capture Keyframe
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between px-2">
                      <h3 className="text-xl font-black text-text-main flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center">
                          <Bookmark className="w-5 h-5 text-accent" />
                        </div>
                        Captured Keyframes
                      </h3>
                      <Badge variant="secondary" className="bg-accent text-accent-foreground border-none px-3 py-1 rounded-full font-bold">
                        {videoTasks.length} Frames
                      </Badge>
                    </div>
                    
                    <ScrollArea className="w-full whitespace-nowrap rounded-2xl border border-border bg-card p-6 shadow-sleek">
                      <div className="flex gap-6">
                        {videoTasks.map((task) => (
                          <div 
                            key={task.id}
                            onClick={() => {
                              selectVideoTask(task);
                              setVideoWorkflowMode('labeling');
                            }}
                            className={cn(
                              "relative w-64 aspect-video rounded-xl overflow-hidden cursor-pointer border-4 transition-all hover:scale-[1.05] active:scale-[0.95] group/item shadow-sm",
                              activeTaskId === task.id ? "border-accent shadow-accent/20" : "border-transparent hover:border-accent/30"
                            )}
                          >
                            <img src={task.thumbnail} className="w-full h-full object-cover" alt="Frame" />
                            <div className="absolute inset-0 bg-black/10 group-hover/item:bg-transparent transition-colors" />
                            <div className="absolute bottom-3 right-3 bg-black/70 text-white text-[11px] px-2 py-1 rounded-md font-bold font-mono backdrop-blur-md">
                              {task.timestamp.toFixed(1)}s
                            </div>
                            <Button 
                              variant="destructive" 
                              size="icon" 
                              className="absolute top-3 right-3 h-8 w-8 opacity-0 group-hover/item:opacity-100 transition-opacity shadow-lg"
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteVideoTask(task.id);
                              }}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        ))}
                        {videoTasks.length === 0 && (
                          <div className="w-full py-16 flex flex-col items-center justify-center text-text-muted border-4 border-dashed border-border rounded-2xl bg-muted/30">
                            <Video className="w-12 h-12 mb-4 opacity-10" />
                            <p className="text-lg font-bold text-muted-foreground">No keyframes captured yet</p>
                            <p className="text-sm text-muted-foreground">Use the video player above to select frames for labeling</p>
                          </div>
                        )}
                      </div>
                      <ScrollBar orientation="horizontal" />
                    </ScrollArea>
                  </div>
                </div>
              </div>
          ) : (
            <>
              {activeImageUrl && (
                <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-1 bg-card/90 backdrop-blur-sm border border-border p-1.5 rounded-xl shadow-sleek">
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-8 w-8 text-text-muted hover:text-text-main"
                    onClick={handleZoomOut}
                    title="Zoom Out"
                  >
                    <ZoomOut className="w-4 h-4" />
                  </Button>
                  <div className="px-2 text-[11px] font-bold text-text-main min-w-[45px] text-center">
                    {Math.round(zoom * 100)}%
                  </div>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-8 w-8 text-text-muted hover:text-text-main"
                    onClick={handleZoomIn}
                    title="Zoom In"
                  >
                    <ZoomIn className="w-4 h-4" />
                  </Button>
                  <Separator orientation="vertical" className="h-4 mx-1" />
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-8 w-8 text-text-muted hover:text-text-main"
                    onClick={resetZoom}
                    title="Fit to Page (ESC)"
                  >
                    <RotateCcw className="w-4 h-4" />
                  </Button>
                </div>
              )}

              {!activeImageUrl ? (
                <div className="text-center space-y-4 max-w-md">
                  <div className="w-20 h-20 bg-card rounded-3xl shadow-sleek flex items-center justify-center mx-auto text-muted-foreground">
                    <ImageIcon className="w-10 h-10" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-xl font-bold text-text-main">Ready to start?</h3>
                    <p className="text-text-muted text-sm">
                      Enter an image URL in the header to begin labeling.
                    </p>
                  </div>
                </div>
              ) : (
                <div 
                  className="relative shadow-sleek bg-card rounded-sm cursor-crosshair transition-all duration-200 ease-out origin-center"
                  style={{ 
                    width: imageSize.width ? `${zoom * 100}%` : 'auto',
                    maxWidth: zoom === 1 ? '100%' : 'none',
                    maxHeight: zoom === 1 ? '100%' : 'none',
                    aspectRatio: imageSize.width ? `${imageSize.width}/${imageSize.height}` : 'auto',
                    transform: zoom > 1 ? `scale(1)` : `scale(1)` // We use width/height for zoom to enable scrolling
                  }}
                >
                  <div 
                    ref={containerRef}
                    className="relative w-full h-full select-none"
                    onMouseDown={handleMouseDown}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    onMouseLeave={handleMouseUp}
                    onDoubleClick={handleDoubleClick}
                  >
                    <img 
                      ref={imageRef}
                      src={activeImageUrl} 
                      alt="Labeling target" 
                      className="block w-full h-auto pointer-events-none"
                      onLoad={onImageLoad}
                      referrerPolicy="no-referrer"
                    />
                    
                    {/* SVG Overlay for Drawing */}
                    <svg 
                      className="absolute inset-0 w-full h-full pointer-events-none"
                      viewBox="0 0 100 100"
                      preserveAspectRatio="none"
                    >
                      {/* Existing Labels */}
                      {labels.map((label) => (
                        <g key={label.id}>
                          <rect 
                            x={label.x}
                            y={label.y}
                            width={label.width}
                            height={label.height}
                            fill="none"
                            stroke={label.verified ? "#10b981" : "var(--accent)"}
                            strokeWidth={editingLabelId === label.id ? "0.6" : "0.3"}
                            className={cn(
                              "transition-all duration-200",
                              editingLabelId === label.id && "animate-breathe-glow"
                            )}
                          />
                          {label.text && (
                            <foreignObject
                              x={label.x}
                              y={label.y - 6 > 0 ? label.y - 6 : label.y}
                              width="100"
                              height="10"
                            >
                              <div className={cn(
                                "text-accent-foreground text-[2.5px] px-1.5 py-0.5 rounded-t-sm inline-block whitespace-nowrap font-bold uppercase tracking-tighter",
                                label.verified ? "bg-green-500" : "bg-accent"
                              )}>
                                {label.text}
                              </div>
                            </foreignObject>
                          )}
                        </g>
                      ))}

                      {/* Current Drawing Box */}
                      {currentBox && (
                        <rect 
                          x={currentBox.x}
                          y={currentBox.y}
                          width={currentBox.width}
                          height={currentBox.height}
                          fill="rgba(59, 130, 246, 0.1)"
                          stroke="#3b82f6"
                          strokeWidth="0.4"
                        />
                      )}
                    </svg>

                    {/* On-screen input for active label */}
                    <AnimatePresence>
                      {editingLabelId && labels.find(l => l.id === editingLabelId) && (
                        <motion.div
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.95 }}
                          className="absolute z-10 pointer-events-auto"
                          style={{
                            left: `${labels.find(l => l.id === editingLabelId)!.x}%`,
                            top: `${labels.find(l => l.id === editingLabelId)!.y + labels.find(l => l.id === editingLabelId)!.height}%`,
                            marginTop: '8px',
                            width: '380px'
                          }}
                        >
                          <div className="bg-white rounded-lg shadow-xl border border-accent p-2 flex gap-2">
                            <Input 
                              autoFocus
                              value={labels.find(l => l.id === editingLabelId)!.text}
                              onChange={(e) => updateLabelText(editingLabelId, e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') setEditingLabelId(null);
                              }}
                              placeholder="Enter text..."
                              className="h-8 text-xs border-border focus-visible:ring-accent bg-white text-black flex-1"
                            />
                            <Button 
                              size="icon" 
                              variant="ghost" 
                              className={cn(
                                "h-8 w-8 shrink-0",
                                labels.find(l => l.id === editingLabelId)!.verified ? "text-green-500 hover:text-green-600" : "text-text-muted hover:text-green-500"
                              )}
                              onClick={() => toggleVerifyLabel(editingLabelId)}
                              title={labels.find(l => l.id === editingLabelId)!.verified ? "Unverify" : "Verify"}
                            >
                              {labels.find(l => l.id === editingLabelId)!.verified ? <CheckCircle2 className="w-4 h-4" /> : <Circle className="w-4 h-4" />}
                            </Button>
                            <Button 
                              size="icon" 
                              variant="ghost" 
                              className="h-8 w-8 shrink-0 hover:bg-muted"
                              onClick={() => setEditingLabelId(null)}
                            >
                              <X className="w-4 h-4" />
                            </Button>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Resolution Badge */}
                    <div className="absolute bottom-3 right-3 bg-black/60 text-white px-2 py-1 rounded text-[10px] font-bold">
                      {imageSize.width} x {imageSize.height} px
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Right Sidebar (Annotations) */}
        <aside className="w-[300px] border-l border-border bg-sidebar flex flex-col shrink-0">
          <div className="p-5 border-b border-border bg-muted/20">
            <h2 className="text-[12px] font-bold text-text-muted uppercase tracking-wider">
              Annotations List ({labels.length})
            </h2>
          </div>
          
          <div className="px-4 pt-4">
            <div className="p-3 bg-accent/10 border border-accent/20 rounded-lg text-[11px] text-foreground leading-relaxed">
              <strong>Drawing Tool Active:</strong> Click and drag on the image to create a new EasyOCR box. Type text directly in the box or sidebar.
            </div>
          </div>

          <ScrollArea className="flex-1 max-h-[80vh]">
            <div className="p-3 space-y-1.5">
              {labels.length === 0 ? (
                <div className="py-12 text-center">
                  <div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center mx-auto mb-3">
                    <MousePointer2 className="w-6 h-6 text-text-muted opacity-20" />
                  </div>
                  <p className="text-xs text-text-muted italic">No annotations yet</p>
                  <p className="text-[10px] text-text-muted mt-1">Start drawing on the image</p>
                </div>
              ) : (
                labels.map((label, idx) => (
                  <motion.div 
                    key={label.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    onClick={() => setEditingLabelId(label.id)}
                    onDoubleClick={() => toggleVerifyLabel(label.id)}
                    className={cn(
                      "flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-all duration-200 group",
                      editingLabelId === label.id 
                        ? "border-accent bg-accent/5 shadow-sm" 
                        : "border-border bg-card hover:border-accent/30"
                    )}
                  >
                    <div className={cn(
                      "w-6 h-6 rounded-md flex items-center justify-center text-[9px] font-bold shrink-0",
                      label.verified ? "bg-green-500/10 text-green-500" : "bg-accent/10 text-accent"
                    )}>
                      {idx + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className={cn(
                        "text-[13px] font-bold block truncate",
                        label.verified && "text-green-600"
                      )}>
                        {label.text || `Box #${idx + 1}`}
                      </span>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] text-text-muted font-mono">
                          {Math.round(label.width)}x{Math.round(label.height)}
                        </span>
                        <div className="w-1 h-1 rounded-full bg-border" />
                        <span className="text-[10px] text-text-muted font-mono">
                          {Math.round(label.x)},{Math.round(label.y)}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className={cn(
                          "h-7 w-7 shrink-0",
                          label.verified ? "text-green-500 hover:text-green-600" : "text-text-muted hover:text-green-500"
                        )}
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleVerifyLabel(label.id);
                        }}
                      >
                        {label.verified ? <CheckCircle2 className="w-4 h-4" /> : <Circle className="w-4 h-4" />}
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-7 w-7 text-text-muted hover:text-red-500 shrink-0"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteLabel(label.id);
                        }}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </motion.div>
                ))
              )}
            </div>
          </ScrollArea>
        </aside>
      </motion.div>
    ) : (
            <motion.div 
              key="stats"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="flex-1 overflow-y-auto bg-background p-8"
            >
              <div className="max-w-6xl mx-auto space-y-8">
                <div className="flex items-end justify-between">
                  <div>
                    <h2 className="text-3xl font-extrabold tracking-tight text-text-main">Dataset Analysis</h2>
                    <p className="text-text-muted font-medium">Character coverage and frequency distribution for all tasks in the current project.</p>
                  </div>
                  <div className="flex gap-4">
                    <Card className="bg-card shadow-sm border-border px-6 py-3 flex flex-col items-center">
                      <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Coverage</span>
                      <span className="text-2xl font-black text-accent">{analysis.coverage.toFixed(1)}%</span>
                    </Card>
                    <Card className="bg-card shadow-sm border-border px-6 py-3 flex flex-col items-center">
                      <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Total Labels</span>
                      <span className="text-2xl font-black text-text-main">{analysis.totalLabels}</span>
                    </Card>
                    <Card className="bg-card shadow-sm border-border px-6 py-3 flex flex-col items-center">
                      <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Total Chars</span>
                      <span className="text-2xl font-black text-text-main">{analysis.totalChars}</span>
                    </Card>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  {/* Frequency Chart */}
                  <Card className="lg:col-span-2 shadow-sleek border-border overflow-hidden">
                    <CardHeader className="bg-card border-b border-border">
                      <CardTitle className="text-sm font-bold uppercase tracking-wider text-text-muted">Character Frequency</CardTitle>
                    </CardHeader>
                    <CardContent className="p-6 h-[400px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={analysis.chartData}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                          <XAxis 
                            dataKey="name" 
                            axisLine={false} 
                            tickLine={false} 
                            tick={{ fontSize: 10, fontWeight: 700, fill: 'var(--muted-foreground)' }}
                          />
                          <YAxis 
                            axisLine={false} 
                            tickLine={false} 
                            tick={{ fontSize: 10, fontWeight: 700, fill: 'var(--muted-foreground)' }}
                          />
                          <Tooltip 
                            cursor={{ fill: 'var(--muted)' }}
                            contentStyle={{ backgroundColor: 'var(--card)', borderRadius: '8px', border: '1px solid var(--border)', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                          />
                          <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                            {analysis.chartData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.count > 0 ? 'var(--accent)' : 'var(--muted)'} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>

                  {/* Missing Characters */}
                  <Card className="shadow-sleek border-border flex flex-col">
                    <CardHeader className="bg-card border-b border-border">
                      <CardTitle className="text-sm font-bold uppercase tracking-wider text-text-muted">Missing in Sample</CardTitle>
                      <CardDescription className="text-xs">Characters not yet labeled in this set.</CardDescription>
                    </CardHeader>
                    <CardContent className="p-6 flex-1">
                      <div className="grid grid-cols-6 gap-2">
                        {analysis.missing.map(char => (
                          <div 
                            key={char} 
                            className="aspect-square flex items-center justify-center bg-muted rounded-md text-sm font-bold text-muted-foreground border border-border"
                          >
                            {char}
                          </div>
                        ))}
                        {analysis.missing.length === 0 && (
                          <div className="col-span-6 py-12 text-center">
                            <div className="w-12 h-12 bg-green-500/10 text-green-500 rounded-full flex items-center justify-center mx-auto mb-3">
                              <Plus className="w-6 h-6 rotate-45" />
                            </div>
                            <p className="text-sm font-bold text-green-600">Full Coverage!</p>
                            <p className="text-xs text-text-muted">All alphanumeric characters are present.</p>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Summary Table */}
                <Card className="shadow-sleek border-border overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-muted border-b border-border">
                          <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-text-muted">Character</th>
                          <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-text-muted">Type</th>
                          <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-text-muted">Count</th>
                          <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-text-muted">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border bg-card">
                        {analysis.chartData.filter(d => d.count > 0).sort((a, b) => b.count - a.count).map(item => (
                          <tr key={item.name} className="hover:bg-muted/50 transition-colors">
                            <td className="px-6 py-4 font-black text-lg">{item.name}</td>
                            <td className="px-6 py-4">
                              <Badge variant="secondary" className="capitalize text-[10px]">{item.type}</Badge>
                            </td>
                            <td className="px-6 py-4 font-mono font-bold">{item.count}</td>
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-2">
                                <div className="h-1.5 w-24 bg-muted rounded-full overflow-hidden">
                                  <div 
                                    className="h-full bg-accent" 
                                    style={{ width: `${Math.min(100, (item.count / analysis.totalChars) * 500)}%` }}
                                  />
                                </div>
                                <span className="text-[10px] font-bold text-text-muted">
                                  {((item.count / analysis.totalChars) * 100).toFixed(1)}%
                                </span>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card>
              </div>
            </motion.div>
          )}

          {viewMode === 'export' && (
            <motion.div 
              key="export"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="flex-1 overflow-y-auto bg-background p-8"
            >
              <div className="max-w-6xl mx-auto space-y-8">
                <div className="flex items-end justify-between">
                  <div>
                    <h2 className="text-3xl font-extrabold tracking-tight text-text-main">Dataset Export</h2>
                    <p className="text-text-muted font-medium">Preview augmentations and export your dataset as a ZIP file.</p>
                  </div>
                  <div className="flex gap-4">
                    <Button 
                      onClick={() => setRandomSeed(Math.random())}
                      variant="outline"
                      className="border-border hover:bg-muted font-bold h-12 px-6 flex items-center gap-2"
                    >
                      <RefreshCw className="w-4 h-4" />
                      Randomize Samples
                    </Button>
                    <Button 
                      onClick={() => exportDatasetZip('current')} 
                      disabled={!activeImageUrl || labels.length === 0 || isExportingZip}
                      className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold h-12 px-6 flex items-center gap-2"
                    >
                      {isExportingZip ? <Loader2 className="w-4 h-4 animate-spin" /> : <Archive className="w-4 h-4" />}
                      Export Current Task
                    </Button>
                    <Button 
                      onClick={() => exportDatasetZip('all')} 
                      disabled={(videoTasks.length === 0 && labels.length === 0) || isExportingZip}
                      className="bg-accent hover:bg-accent/90 text-accent-foreground font-bold h-12 px-6 flex items-center gap-2"
                    >
                      {isExportingZip ? <Loader2 className="w-4 h-4 animate-spin" /> : <Archive className="w-4 h-4" />}
                      Export All Tasks
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                  {/* Augmentation Controls */}
                  <Card className="shadow-sleek border-border overflow-hidden">
                    <CardHeader className="bg-card border-b border-border">
                      <CardTitle className="text-sm font-bold uppercase tracking-wider text-text-muted">Augmentations</CardTitle>
                    </CardHeader>
                    <CardContent className="p-6 space-y-6">
                      <div className="space-y-3">
                        <div className="flex justify-between items-center">
                          <label className="text-xs font-bold text-text-muted uppercase">Blurring</label>
                          <span className="text-xs font-mono text-accent">{augBlur}%</span>
                        </div>
                        <input 
                          type="range" 
                          min="0" 
                          max="60" 
                          value={augBlur} 
                          onChange={(e) => setAugBlur(parseInt(e.target.value))}
                          className="w-full accent-accent"
                        />
                      </div>

                      <div className="space-y-3">
                        <div className="flex justify-between items-center">
                          <label className="text-xs font-bold text-text-muted uppercase">Perspective X</label>
                          <span className="text-xs font-mono text-accent">{augPerspectiveX}%</span>
                        </div>
                        <input 
                          type="range" 
                          min="-50" 
                          max="50" 
                          value={augPerspectiveX} 
                          onChange={(e) => setAugPerspectiveX(parseInt(e.target.value))}
                          className="w-full accent-accent"
                        />
                      </div>

                      <div className="space-y-3">
                        <div className="flex justify-between items-center">
                          <label className="text-xs font-bold text-text-muted uppercase">Perspective Y</label>
                          <span className="text-xs font-mono text-accent">{augPerspectiveY}%</span>
                        </div>
                        <input 
                          type="range" 
                          min="-50" 
                          max="50" 
                          value={augPerspectiveY} 
                          onChange={(e) => setAugPerspectiveY(parseInt(e.target.value))}
                          className="w-full accent-accent"
                        />
                      </div>

                      <div className="space-y-4 pt-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-text-muted uppercase">Stretch Mode</span>
                          <button 
                            onClick={() => setAugStretch(!augStretch)}
                            className={cn(
                              "w-10 h-5 rounded-full transition-colors relative",
                              augStretch ? "bg-accent" : "bg-muted"
                            )}
                          >
                            <div className={cn(
                              "absolute top-1 w-3 h-3 bg-white rounded-full transition-all",
                              augStretch ? "left-6" : "left-1"
                            )} />
                          </button>
                        </div>

                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-text-muted uppercase">Lock Aspect Ratio</span>
                          <button 
                            onClick={() => setAugLockAspectRatio(!augLockAspectRatio)}
                            className={cn(
                              "w-10 h-5 rounded-full transition-colors relative",
                              augLockAspectRatio ? "bg-accent" : "bg-muted"
                            )}
                          >
                            <div className={cn(
                              "absolute top-1 w-3 h-3 bg-white rounded-full transition-all",
                              augLockAspectRatio ? "left-6" : "left-1"
                            )} />
                          </button>
                        </div>
                      </div>
                      
                      <div className="pt-4 border-t border-border">
                        <p className="text-[10px] text-text-muted leading-relaxed">
                          Augmentations are applied to the preview crops below to simulate how they might look in your training pipeline.
                        </p>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Batch Export Settings */}
                  <Card className="shadow-sleek border-border overflow-hidden">
                    <CardHeader className="bg-card border-b border-border">
                      <CardTitle className="text-sm font-bold uppercase tracking-wider text-text-muted">Batch Export Settings</CardTitle>
                    </CardHeader>
                    <CardContent className="p-6 space-y-6">
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <div className="text-[10px] font-bold text-accent uppercase tracking-widest">Blurring Range</div>
                          <button 
                            onClick={() => setEnableBatchBlur(!enableBatchBlur)}
                            className={cn(
                              "w-8 h-4 rounded-full transition-colors relative",
                              enableBatchBlur ? "bg-accent" : "bg-muted"
                            )}
                          >
                            <div className={cn(
                              "absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all",
                              enableBatchBlur ? "left-4.5" : "left-0.5"
                            )} />
                          </button>
                        </div>
                        <div className={cn("grid grid-cols-3 gap-2 transition-opacity", !enableBatchBlur && "opacity-30 pointer-events-none")}>
                          <div className="space-y-1">
                            <label className="text-[8px] font-bold text-text-muted uppercase">Min</label>
                            <Input type="number" value={batchBlurMin} onChange={e => setBatchBlurMin(Number(e.target.value))} className="h-7 text-[10px] bg-muted/50 border-none" />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[8px] font-bold text-text-muted uppercase">Max</label>
                            <Input type="number" value={batchBlurMax} onChange={e => setBatchBlurMax(Number(e.target.value))} className="h-7 text-[10px] bg-muted/50 border-none" />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[8px] font-bold text-text-muted uppercase">Steps</label>
                            <Input type="number" value={batchBlurSteps} onChange={e => setBatchBlurSteps(Number(e.target.value))} className="h-7 text-[10px] bg-muted/50 border-none" />
                          </div>
                        </div>
                      </div>

                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <div className="text-[10px] font-bold text-accent uppercase tracking-widest">Persp X Range</div>
                          <button 
                            onClick={() => setEnableBatchPerspX(!enableBatchPerspX)}
                            className={cn(
                              "w-8 h-4 rounded-full transition-colors relative",
                              enableBatchPerspX ? "bg-accent" : "bg-muted"
                            )}
                          >
                            <div className={cn(
                              "absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all",
                              enableBatchPerspX ? "left-4.5" : "left-0.5"
                            )} />
                          </button>
                        </div>
                        <div className={cn("grid grid-cols-3 gap-2 transition-opacity", !enableBatchPerspX && "opacity-30 pointer-events-none")}>
                          <div className="space-y-1">
                            <label className="text-[8px] font-bold text-text-muted uppercase">Min</label>
                            <Input type="number" value={batchPerspXMin} onChange={e => setBatchPerspXMin(Number(e.target.value))} className="h-7 text-[10px] bg-muted/50 border-none" />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[8px] font-bold text-text-muted uppercase">Max</label>
                            <Input type="number" value={batchPerspXMax} onChange={e => setBatchPerspXMax(Number(e.target.value))} className="h-7 text-[10px] bg-muted/50 border-none" />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[8px] font-bold text-text-muted uppercase">Steps</label>
                            <Input type="number" value={batchPerspXSteps} onChange={e => setBatchPerspXSteps(Number(e.target.value))} className="h-7 text-[10px] bg-muted/50 border-none" />
                          </div>
                        </div>
                      </div>

                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <div className="text-[10px] font-bold text-accent uppercase tracking-widest">Persp Y Range</div>
                          <button 
                            onClick={() => setEnableBatchPerspY(!enableBatchPerspY)}
                            className={cn(
                              "w-8 h-4 rounded-full transition-colors relative",
                              enableBatchPerspY ? "bg-accent" : "bg-muted"
                            )}
                          >
                            <div className={cn(
                              "absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all",
                              enableBatchPerspY ? "left-4.5" : "left-0.5"
                            )} />
                          </button>
                        </div>
                        <div className={cn("grid grid-cols-3 gap-2 transition-opacity", !enableBatchPerspY && "opacity-30 pointer-events-none")}>
                          <div className="space-y-1">
                            <label className="text-[8px] font-bold text-text-muted uppercase">Min</label>
                            <Input type="number" value={batchPerspYMin} onChange={e => setBatchPerspYMin(Number(e.target.value))} className="h-7 text-[10px] bg-muted/50 border-none" />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[8px] font-bold text-text-muted uppercase">Max</label>
                            <Input type="number" value={batchPerspYMax} onChange={e => setBatchPerspYMax(Number(e.target.value))} className="h-7 text-[10px] bg-muted/50 border-none" />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[8px] font-bold text-text-muted uppercase">Steps</label>
                            <Input type="number" value={batchPerspYSteps} onChange={e => setBatchPerspYSteps(Number(e.target.value))} className="h-7 text-[10px] bg-muted/50 border-none" />
                          </div>
                        </div>
                      </div>

                      <div className="pt-4 border-t border-border">
                        <p className="text-[9px] text-text-muted leading-relaxed italic">
                          Total images per crop: {(enableBatchBlur ? batchBlurSteps : 1) * (enableBatchPerspX ? batchPerspXSteps : 1) * (enableBatchPerspY ? batchPerspYSteps : 1)}
                        </p>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Preview Grid */}
                  <div className="lg:col-span-3">
                    <div className="grid grid-cols-3 gap-4">
                      {sampledCrops.length > 0 ? (
                        sampledCrops.map((crop, idx) => (
                          <div 
                            key={`${crop.task.id}-${crop.label.id}-${idx}`} 
                            className={cn(
                              "bg-card rounded-xl border border-border overflow-hidden shadow-sm relative group",
                              augLockAspectRatio ? "" : "aspect-square"
                            )}
                            style={augLockAspectRatio ? { aspectRatio: `${crop.label.width}/${crop.label.height}` } : {}}
                          >
                            <div 
                              className="w-full h-full transition-all duration-300"
                              style={{
                                filter: `blur(${augBlur / 10}px)`,
                                transform: `perspective(500px) rotateY(${augPerspectiveX}deg) rotateX(${augPerspectiveY}deg)`,
                              }}
                            >
                               <div 
                                 className="w-full h-full"
                                 style={{
                                   backgroundImage: `url(${crop.task.thumbnail})`,
                                   backgroundPosition: `${crop.label.x / (100 - crop.label.width) * 100}% ${crop.label.y / (100 - crop.label.height) * 100}%`,
                                   backgroundSize: augStretch ? '100% 100%' : `${10000 / crop.label.width}% ${10000 / crop.label.height}%`,
                                   backgroundRepeat: 'no-repeat'
                                 }}
                               />
                            </div>
                            <div className="absolute inset-0 border-2 border-transparent group-hover:border-accent/30 transition-colors pointer-events-none rounded-xl" />
                            <div className="absolute bottom-2 left-2 bg-black/60 backdrop-blur-sm text-white text-[8px] px-1.5 py-0.5 rounded font-mono">
                              {crop.label.text || 'unlabeled'}
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="col-span-3 py-24 text-center bg-card rounded-2xl border border-dashed border-border">
                          <Archive className="w-12 h-12 text-text-muted opacity-20 mx-auto mb-4" />
                          <p className="text-text-muted font-bold">No samples available</p>
                          <p className="text-xs text-text-muted">Create some annotations first to see previews here.</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Fullscreen Preview Overlay */}
      <AnimatePresence>
        {isFullscreen && activeImageUrl && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center p-4 md:p-12"
          >
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => setIsFullscreen(false)}
              className="absolute top-6 right-6 text-white hover:bg-white/10 z-[110]"
            >
              <X className="w-8 h-8" />
            </Button>

            <div className="relative w-full h-full flex items-center justify-center">
              <div 
                className="relative bg-card shadow-2xl rounded-sm overflow-hidden"
                style={{ 
                  maxWidth: '100%', 
                  maxHeight: '100%',
                  aspectRatio: imageSize.width ? `${imageSize.width}/${imageSize.height}` : 'auto'
                }}
              >
                <img 
                  src={activeImageUrl} 
                  alt="Fullscreen preview" 
                  className="block w-full h-auto"
                  referrerPolicy="no-referrer"
                />
                <svg 
                  className="absolute inset-0 w-full h-full pointer-events-none"
                  viewBox="0 0 100 100"
                  preserveAspectRatio="none"
                >
                  {labels.map((label) => (
                    <g key={label.id}>
                      <rect 
                        x={label.x}
                        y={label.y}
                        width={label.width}
                        height={label.height}
                        fill="none"
                        stroke="var(--accent)"
                        strokeWidth="0.3"
                      />
                      {label.text && (
                        <foreignObject
                          x={label.x}
                          y={label.y - 4 > 0 ? label.y - 4 : label.y}
                          width="100"
                          height="10"
                        >
                          <div className="bg-accent text-accent-foreground text-[2px] px-1 py-0.5 rounded-t-sm inline-block whitespace-nowrap font-bold uppercase tracking-tighter">
                            {label.text}
                          </div>
                        </foreignObject>
                      )}
                    </g>
                  ))}
                </svg>
              </div>
            </div>
            
            <div className="absolute bottom-8 left-1/2 -translate-x-1/2 bg-white/10 backdrop-blur-md px-6 py-3 rounded-full border border-white/20 flex gap-8">
              <div className="flex flex-col items-center">
                <span className="text-[10px] font-bold text-white/60 uppercase tracking-widest">Labels</span>
                <span className="text-xl font-black text-white">{labels.length}</span>
              </div>
              <div className="w-px h-8 bg-white/20" />
              <div className="flex flex-col items-center">
                <span className="text-[10px] font-bold text-white/60 uppercase tracking-widest">Coverage</span>
                <span className="text-xl font-black text-accent">{analysis.coverage.toFixed(1)}%</span>
              </div>
              <div className="w-px h-8 bg-white/20" />
              <div className="flex flex-col items-center">
                <span className="text-[10px] font-bold text-white/60 uppercase tracking-widest">Resolution</span>
                <span className="text-xl font-black text-white">{imageSize.width}x{imageSize.height}</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
