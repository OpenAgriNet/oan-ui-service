import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Camera, ImageIcon, X, Loader2 } from "lucide-react";
import { getCrops, FALLBACK_CROPS, type CropItem } from "@/lib/pest-detection-api";
import { useLanguage } from "@/components/LanguageProvider";
import { toast } from "@/hooks/use-toast";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/jpg"];
const MAX_COMPRESSED_DIMENSION = 4096;
const JPEG_QUALITY_STEPS = [0.88, 0.76, 0.64, 0.52];

const getLocalDateDaysAgo = (days: number): string => {
  const date = new Date();
  date.setDate(date.getDate() - days);
  const timezoneOffset = date.getTimezoneOffset() * 60 * 1000;
  return new Date(date.getTime() - timezoneOffset).toISOString().split("T")[0];
};

const canvasToBlob = (canvas: HTMLCanvasElement, quality: number): Promise<Blob> =>
  new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => blob ? resolve(blob) : reject(new Error("Image compression failed")),
      "image/jpeg",
      quality
    );
  });

const loadImage = (file: File): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Could not read image"));
    };
    image.src = objectUrl;
  });

const compressImageUnderLimit = async (file: File): Promise<File> => {
  const image = await loadImage(file);
  const initialScale = Math.min(
    1,
    MAX_COMPRESSED_DIMENSION / Math.max(image.naturalWidth, image.naturalHeight)
  );
  let width = Math.max(1, Math.round(image.naturalWidth * initialScale));
  let height = Math.max(1, Math.round(image.naturalHeight * initialScale));
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Image compression is unavailable");

  for (let resizeAttempt = 0; resizeAttempt < 4; resizeAttempt += 1) {
    canvas.width = width;
    canvas.height = height;
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, width, height);
    context.drawImage(image, 0, 0, width, height);

    for (const quality of JPEG_QUALITY_STEPS) {
      const blob = await canvasToBlob(canvas, quality);
      if (blob.size <= MAX_FILE_SIZE) {
        const baseName = file.name.replace(/\.(jpe?g|png)$/i, "") || "crop-image";
        return new File([blob], `${baseName}.jpg`, {
          type: "image/jpeg",
          lastModified: Date.now(),
        });
      }
    }

    width = Math.max(1, Math.round(width * 0.75));
    height = Math.max(1, Math.round(height * 0.75));
  }

  throw new Error("Image could not be compressed below 10 MB");
};

interface PestDetectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (
    cropId: string,
    cropName: string,
    sowingDate: string,
    image: File,
    cropNameEnglish?: string
  ) => void;
  isSubmitting?: boolean;
}

export function PestDetectionDialog({
  open,
  onOpenChange,
  onSubmit,
  isSubmitting = false,
}: PestDetectionDialogProps) {
  const { t, language } = useLanguage();
  const [crops, setCrops] = useState<CropItem[]>([]);
  const [loadingCrops, setLoadingCrops] = useState(false);
  const [selectedCropId, setSelectedCropId] = useState<string>("");
  const [sowingDate, setSowingDate] = useState<string>("");
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isCompressing, setIsCompressing] = useState(false);

  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  // Fetch crops on dialog open
  useEffect(() => {
    if (!open) return;

    let isCancelled = false;
    setLoadingCrops(true);

    getCrops()
      .then((data) => {
        if (isCancelled) return;
        // Always prefer latest response-driven crop list.
        setCrops(data.length > 0 ? data : FALLBACK_CROPS);
      })
      .catch((err) => {
        if (isCancelled) return;
        console.error("Failed to fetch crops, using fallback list:", err);
        setCrops(FALLBACK_CROPS);
      })
      .finally(() => {
        if (!isCancelled) {
          setLoadingCrops(false);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [open]);

  // Reset form when dialog closes
  useEffect(() => {
    if (!open) {
      setSelectedCropId("");
      setSowingDate("");
      setSelectedImage(null);
      setImagePreview(null);
      setIsCompressing(false);
    }
  }, [open]);

  const validateFile = (file: File): boolean => {
    if (!ACCEPTED_TYPES.includes(file.type)) {
      toast({
        title: t("pestDetection.invalidFormat") as string || "Invalid format",
        description: t("pestDetection.imageFormatHint") as string || "Only JPEG, PNG, and JPG formats allowed.",
        variant: "destructive",
      });
      return false;
    }
    return true;
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = ""; // allow the same file to be selected again
    if (!validateFile(file)) {
      return;
    }

    try {
      let uploadFile = file;
      if (file.size > MAX_FILE_SIZE) {
        setIsCompressing(true);
        uploadFile = await compressImageUnderLimit(file);
        toast({
          title: t("pestDetection.imageCompressed") as string,
          description: t("pestDetection.imageCompressedDescription") as string,
        });
      }

      if (uploadFile.size > MAX_FILE_SIZE) {
        throw new Error("Compressed image is still over 10 MB");
      }

      setSelectedImage(uploadFile);
      const reader = new FileReader();
      reader.onload = () => setImagePreview(reader.result as string);
      reader.readAsDataURL(uploadFile);
    } catch (error) {
      console.error("Image compression failed:", error);
      toast({
        title: t("pestDetection.fileTooLarge") as string,
        description: t("pestDetection.compressionFailed") as string,
        variant: "destructive",
      });
    } finally {
      setIsCompressing(false);
    }
  };

  const removeImage = () => {
    setSelectedImage(null);
    setImagePreview(null);
  };

  const getLocalizedCropName = (crop: CropItem): string => {
    if (language === "mr" && crop.crop_name_mr) return crop.crop_name_mr;
    if (language === "hi" && crop.crop_name_hi) return crop.crop_name_hi;
    return crop.crop_name;
  };

  const handleSubmit = () => {
    if (!selectedCropId || !sowingDate || !selectedImage) return;
    const crop = crops.find((c) => String(c.crop_id) === selectedCropId);
    if (!crop) return;
    onSubmit(selectedCropId, getLocalizedCropName(crop), sowingDate, selectedImage, crop.crop_name);
  };

  const isFormValid = selectedCropId && sowingDate && selectedImage && !isCompressing;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto p-0">
        {/* Green header */}
        <div className="bg-primary text-primary-foreground px-6 py-4 rounded-t-lg">
          <DialogHeader>
            <DialogTitle className="text-primary-foreground text-center text-lg font-semibold">
              {(t("pestDetection.title") as string) || "Pest & Disease Identification"}
            </DialogTitle>
          </DialogHeader>
        </div>

        <div className="px-6 py-4 space-y-5">
          {/* Crop Selector */}
          <div className="space-y-2">
            <Label htmlFor="crop-select" className="text-sm font-medium">
              {(t("pestDetection.selectCrop") as string) || "Select Crop"}
            </Label>
            <Select value={selectedCropId} onValueChange={setSelectedCropId} disabled={loadingCrops}>
              <SelectTrigger id="crop-select" className="w-full">
                <SelectValue placeholder={loadingCrops ? "Loading..." : (t("pestDetection.selectCrop") as string) || "Select Crop"} />
              </SelectTrigger>
              <SelectContent className="max-h-60">
                {crops.map((crop) => (
                  <SelectItem key={crop.crop_id} value={String(crop.crop_id)}>
                    {getLocalizedCropName(crop)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Sowing Date */}
          <div className="space-y-2">
            <Label htmlFor="sowing-date" className="text-sm font-medium">
              {(t("pestDetection.sowingDate") as string) || "Sowing Date"}
            </Label>
            <Input
              id="sowing-date"
              type="date"
              value={sowingDate}
              onChange={(e) => setSowingDate(e.target.value)}
              max={getLocalDateDaysAgo(7)}
              className="w-full"
            />
            <p className="text-xs text-muted-foreground">
              {(t("pestDetection.sowingDateHint") as string) || "Choose a sowing date at least one week ago."}
            </p>
          </div>

          {/* Image Upload Area */}
          <div className="space-y-2">
            <Label className="text-sm font-medium text-muted-foreground uppercase tracking-wide text-center block">
              {(t("pestDetection.plantPestImage") as string) || "Plant/Pest Image"}
            </Label>

            {isCompressing ? (
              <div className="flex items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border p-8 text-sm text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
                {(t("pestDetection.compressingImage") as string) || "Compressing image..."}
              </div>
            ) : imagePreview ? (
              <div className="relative rounded-lg border-2 border-dashed border-border p-2">
                <img
                  src={imagePreview}
                  alt="Selected crop"
                  className="w-full max-h-48 object-contain rounded-md"
                />
                <Button
                  variant="destructive"
                  size="icon"
                  className="absolute top-3 right-3 h-7 w-7 rounded-full"
                  onClick={removeImage}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <div className="border-2 border-dashed border-border rounded-lg p-6">
                <div className="flex justify-center gap-8">
                  {/* Capture Image */}
                  <button
                    type="button"
                    onClick={() => cameraInputRef.current?.click()}
                    className="flex flex-col items-center gap-2 group cursor-pointer"
                  >
                    <div className="w-16 h-16 rounded-full border-2 border-foreground flex items-center justify-center group-hover:border-primary group-hover:bg-primary/5 transition-all">
                      <Camera className="h-7 w-7 group-hover:text-primary transition-colors" />
                    </div>
                    <span className="text-xs text-muted-foreground group-hover:text-primary transition-colors">
                      {(t("pestDetection.captureImage") as string) || "Capture Image"}
                    </span>
                  </button>

                  {/* Select from Gallery */}
                  <button
                    type="button"
                    onClick={() => galleryInputRef.current?.click()}
                    className="flex flex-col items-center gap-2 group cursor-pointer"
                  >
                    <div className="w-16 h-16 rounded-full border-2 border-foreground flex items-center justify-center group-hover:border-primary group-hover:bg-primary/5 transition-all">
                      <ImageIcon className="h-7 w-7 group-hover:text-primary transition-colors" />
                    </div>
                    <span className="text-xs text-muted-foreground group-hover:text-primary transition-colors">
                      {(t("pestDetection.selectFromGallery") as string) || "Select From Gallery"}
                    </span>
                  </button>
                </div>

                <p className="text-xs text-muted-foreground text-center mt-4">
                  {(t("pestDetection.imageFormatHint") as string) || "Only JPEG, PNG, and JPG formats are allowed. Max 10 MB."}
                </p>
              </div>
            )}

            {/* Hidden file inputs */}
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/jpeg,image/png,image/jpg"
              capture="environment"
              onChange={handleFileSelect}
              disabled={isCompressing}
              className="hidden"
            />
            <input
              ref={galleryInputRef}
              type="file"
              accept="image/jpeg,image/png,image/jpg"
              onChange={handleFileSelect}
              disabled={isCompressing}
              className="hidden"
            />
          </div>

          {/* Submit Button */}
          <Button
            onClick={handleSubmit}
            disabled={!isFormValid || isSubmitting}
            className="w-full h-12 rounded-lg text-base font-semibold"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                {(t("pestDetection.analyzing") as string) || "Analyzing..."}
              </>
            ) : (
              (t("pestDetection.analyzeSubmit") as string) || "Analyze & Submit"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
