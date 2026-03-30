"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Settings, Hash, FileText } from "lucide-react";

interface SetupViewProps {
  roomCode: string;
  onGenerate: (category: string, count: number) => void;
  isGenerating: boolean;
}

const CATEGORIES = [
  { id: "general", name: "General Knowledge", emoji: "🌍" },
  { id: "science", name: "Science & Technology", emoji: "🔬" },
  { id: "history", name: "History", emoji: "📜" },
  { id: "geography", name: "Geography", emoji: "🗺️" },
  { id: "entertainment", name: "Entertainment", emoji: "🎬" },
  { id: "sports", name: "Sports", emoji: "⚽" },
  { id: "literature", name: "Literature", emoji: "📚" },
  { id: "art", name: "Art & Culture", emoji: "🎨" },
  { id: "custom", name: "Custom", emoji: "✏️" },
];

export default function SetupView({
  roomCode,
  onGenerate,
  isGenerating,
}: SetupViewProps) {
  const [selectedCategory, setSelectedCategory] = useState("general");
  const [customCategory, setCustomCategory] = useState("");
  const [questionCount, setQuestionCount] = useState(10);

  const handleGenerate = () => {
    const category = selectedCategory === "custom" 
      ? customCategory 
      : CATEGORIES.find(c => c.id === selectedCategory)?.name || "General Knowledge";
    
    onGenerate(category, questionCount);
  };

  const showCustomInput = selectedCategory === "custom";

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 flex items-center justify-center p-4">
      <Card className="w-full max-w-lg bg-white/10 backdrop-blur-xl border-white/20 shadow-2xl">
        <CardHeader className="text-center">
          <div className="mx-auto w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center mb-4">
            <Settings className="w-6 h-6 text-white" />
          </div>
          <CardTitle className="text-2xl font-bold text-white">
            Konfigurasi Pertanyaan
          </CardTitle>
          <p className="text-white/60 mt-2">
            Atur pertanyaan untuk room <span className="font-mono text-indigo-400">{roomCode}</span>
          </p>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Kategori */}
          <div className="space-y-3">
            <label className="text-white/80 font-medium flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Kategori Pertanyaan
            </label>
            <div className="grid grid-cols-3 gap-2">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`p-3 rounded-lg text-sm font-medium transition-all ${
                    selectedCategory === cat.id
                      ? "bg-gradient-to-r from-indigo-500 to-purple-500 text-white shadow-lg scale-105"
                      : "bg-white/5 text-white/70 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  <div className="text-lg mb-1">{cat.emoji}</div>
                  <div className="text-xs leading-tight">{cat.name}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Custom Category Input */}
          {showCustomInput && (
            <div className="space-y-2">
              <label className="text-white/80 text-sm">Kategori Kustom</label>
              <Input
                value={customCategory}
                onChange={(e) => setCustomCategory(e.target.value)}
                placeholder="Bebas apapun!"
                className="bg-white/5 border-white/10 text-white placeholder:text-white/30"
              />
            </div>
          )}

          {/* Jumlah Pertanyaan */}
          <div className="space-y-3">
            <label className="text-white/80 font-medium flex items-center gap-2">
              <Hash className="w-4 h-4" />
              Jumlah Pertanyaan
            </label>
            <div className="flex gap-2">
              {[5, 10, 15, 20].map((count) => (
                <button
                  key={count}
                  onClick={() => setQuestionCount(count)}
                  className={`flex-1 py-3 rounded-lg text-sm font-medium transition-all ${
                    questionCount === count
                      ? "bg-gradient-to-r from-indigo-500 to-purple-500 text-white shadow-lg scale-105"
                      : "bg-white/5 text-white/70 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  {count}
                </button>
              ))}
            </div>
          </div>

          {/* Generate Button */}
          <Button
            onClick={handleGenerate}
            disabled={isGenerating || (showCustomInput && !customCategory.trim())}
            className="w-full bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white font-bold py-6 text-lg shadow-lg disabled:opacity-50"
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                Generate Pertanyaan...
              </>
            ) : (
              "Generate Pertanyaan"
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
