import { useState, useRef } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Upload, AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

export default function UploadPage() {
  const { isAuthenticated } = useAuth();
  const [, navigate] = useLocation();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const createAnalysisMutation = trpc.analyses.create.useMutation();

  if (!isAuthenticated) {
    navigate("/");
    return null;
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    // Validate file type
    const validTypes = ["video/mp4", "video/avi", "video/quicktime", "video/x-msvideo"];
    if (!validTypes.includes(selectedFile.type)) {
      toast.error("Invalid file type. Please upload MP4, AVI, or MOV files.");
      return;
    }

    // Validate file size (max 500MB)
    const maxSize = 500 * 1024 * 1024;
    if (selectedFile.size > maxSize) {
      toast.error("File too large. Maximum size is 500MB.");
      return;
    }

    setFile(selectedFile);
  };

  const handleUpload = async () => {
    if (!title.trim()) {
      toast.error("Please enter a title");
      return;
    }

    if (!file) {
      toast.error("Please select a video file");
      return;
    }

    setUploading(true);
    setUploadProgress(0);

    try {
      // Simulate upload progress
      const progressInterval = setInterval(() => {
        setUploadProgress((prev) => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return prev;
          }
          return prev + Math.random() * 30;
        });
      }, 500);

      // In production, upload to S3 via storagePut
      // For now, simulate with a data URL
      const reader = new FileReader();
      reader.onload = async () => {
        clearInterval(progressInterval);
        setUploadProgress(100);

        try {
          // Create analysis record
          const result = await createAnalysisMutation.mutateAsync({
            title,
            description,
            videoUrl: "https://example.com/video.mp4", // Replace with actual S3 URL
            videoKey: `videos/${Date.now()}-${file.name}`,
          });

          toast.success("Analysis created successfully!");
          setTitle("");
          setDescription("");
          setFile(null);
          setUploadProgress(0);

          // Redirect to dashboard
          setTimeout(() => navigate("/dashboard"), 1000);
        } catch (error) {
          toast.error("Failed to create analysis");
          console.error(error);
        }
      };
      reader.readAsDataURL(file);
    } catch (error) {
      toast.error("Upload failed");
      console.error(error);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900 text-white">
      <div className="border-b border-slate-800 bg-slate-950/50 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <h1 className="text-3xl font-bold">New CFD Analysis</h1>
          <p className="text-slate-400 mt-2">Upload a CFD simulation video for physics validation</p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Upload Form */}
          <div className="lg:col-span-2">
            <Card className="bg-slate-800/50 border-slate-700">
              <CardHeader>
                <CardTitle>Upload Video</CardTitle>
                <CardDescription>Supported formats: MP4, AVI, MOV (max 500MB)</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Title */}
                <div>
                  <Label htmlFor="title" className="text-white mb-2 block">
                    Analysis Title *
                  </Label>
                  <Input
                    id="title"
                    placeholder="e.g., Wing Aerodynamic Analysis"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="bg-slate-700 border-slate-600 text-white placeholder:text-slate-400"
                  />
                </div>

                {/* Description */}
                <div>
                  <Label htmlFor="description" className="text-white mb-2 block">
                    Description
                  </Label>
                  <Textarea
                    id="description"
                    placeholder="Add notes about this simulation..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="bg-slate-700 border-slate-600 text-white placeholder:text-slate-400 resize-none"
                    rows={4}
                  />
                </div>

                {/* File Upload */}
                <div>
                  <Label className="text-white mb-2 block">Video File *</Label>
                  <div
                    className="border-2 border-dashed border-slate-600 rounded-lg p-8 text-center cursor-pointer hover:border-blue-500/50 transition-colors"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="video/*"
                      onChange={handleFileSelect}
                      className="hidden"
                    />
                    <Upload className="w-12 h-12 mx-auto mb-4 text-slate-400" />
                    {file ? (
                      <>
                        <p className="text-white font-semibold">{file.name}</p>
                        <p className="text-slate-400 text-sm">
                          {(file.size / 1024 / 1024).toFixed(2)} MB
                        </p>
                      </>
                    ) : (
                      <>
                        <p className="text-white font-semibold mb-1">
                          Click to upload or drag and drop
                        </p>
                        <p className="text-slate-400 text-sm">
                          MP4, AVI, or MOV (up to 500MB)
                        </p>
                      </>
                    )}
                  </div>
                </div>

                {/* Upload Progress */}
                {uploading && (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-slate-400">Uploading...</span>
                      <span className="text-sm font-semibold text-cyan-400">
                        {Math.round(uploadProgress)}%
                      </span>
                    </div>
                    <div className="w-full h-2 bg-slate-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-blue-500 to-cyan-500 transition-all"
                        style={{ width: `${uploadProgress}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* Submit Button */}
                <Button
                  onClick={handleUpload}
                  disabled={!file || !title.trim() || uploading}
                  className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
                  size="lg"
                >
                  {uploading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4 mr-2" />
                      Start Analysis
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Info Panel */}
          <div className="space-y-4">
            <Card className="bg-blue-500/10 border-blue-500/20">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-blue-400" />
                  Requirements
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-slate-300">
                <div>
                  <p className="font-semibold text-white mb-1">Color Mapping</p>
                  <p>Red channel: U velocity, Green: V velocity, Blue: Pressure</p>
                </div>
                <div>
                  <p className="font-semibold text-white mb-1">Resolution</p>
                  <p>Minimum 320x240, recommended 640x480 or higher</p>
                </div>
                <div>
                  <p className="font-semibold text-white mb-1">Duration</p>
                  <p>5-60 seconds recommended for optimal analysis</p>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-green-500/10 border-green-500/20">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-green-400" />
                  What You Get
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-slate-300">
                <p>✓ Credibility score (0-100)</p>
                <p>✓ PDE residuals analysis</p>
                <p>✓ Anomaly detection</p>
                <p>✓ Field visualizations</p>
                <p>✓ AI-generated report</p>
                <p>✓ Export options</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}