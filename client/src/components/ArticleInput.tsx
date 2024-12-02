import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { convertArticle } from "../lib/api";

const urlFormSchema = z.object({
  url: z.string().url("Please enter a valid URL"),
  content: z.string().optional(),
});

const textFormSchema = z.object({
  url: z.string().optional(),
  content: z.string().min(10, "Content must be at least 10 characters long"),
});

export default function ArticleInput({ onConvert }: { onConvert: () => void }) {
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"url" | "text">("url");
  const { toast } = useToast();
  
  const form = useForm<z.infer<typeof urlFormSchema>>({
    resolver: zodResolver(activeTab === "url" ? urlFormSchema : textFormSchema),
    defaultValues: {
      url: "",
      content: "",
    },
  });

  // Reset the other field when switching tabs
  useEffect(() => {
    if (activeTab === "url") {
      form.setValue("content", "");
      form.clearErrors("content");
    } else {
      form.setValue("url", "");
      form.clearErrors("url");
    }
  }, [activeTab, form]);

  async function onSubmit(values: z.infer<typeof urlFormSchema | typeof textFormSchema>) {
    try {
      setIsLoading(true);
      await convertArticle(values);
      toast({
        title: "Success",
        description: "Article conversion started",
      });
      form.reset();
      onConvert();
    } catch (error) {
      const errorMessage = error.response?.data?.error || "Failed to convert article";
      
      // Enhanced error handling with improved styling and categorization
      let toastDescription = errorMessage;
      
      // Format error message with enhanced styling and auto-switching
      if (errorMessage.includes('\n')) {
        // Split message into title and details
        const [mainError, ...details] = errorMessage.split('\n');
        
        // Format details by type (numbered, bullet points, or suggestions)
        const formattedDetails = details.reduce((acc, detail) => {
          const trimmedDetail = detail.trim();
          if (!trimmedDetail) return acc;
          
          if (trimmedDetail.startsWith('•')) {
            // Handle bullet points
            if (!acc.bullets) acc.bullets = [];
            acc.bullets.push(trimmedDetail.replace(/^•\s*/, ''));
          } else if (/^\d+\./.test(trimmedDetail)) {
            // Handle numbered points
            if (!acc.numbered) acc.numbered = [];
            acc.numbered.push(trimmedDetail.replace(/^\d+\.\s*/, ''));
          } else if (trimmedDetail.toLowerCase().includes('suggestion')) {
            // Handle suggestions
            if (!acc.suggestions) acc.suggestions = [];
            acc.suggestions.push(trimmedDetail);
          } else {
            // Other details
            if (!acc.other) acc.other = [];
            acc.other.push(trimmedDetail);
          }
          return acc;
        }, {} as { bullets?: string[], numbered?: string[], suggestions?: string[], other?: string[] });

        toastDescription = (
          <div className="space-y-3">
            <p className="font-medium text-base">{mainError}</p>
            
            {formattedDetails.numbered && (
              <div className="space-y-1">
                <p className="font-medium text-sm">Steps to resolve:</p>
                <ul className="list-decimal pl-4 space-y-1 text-sm">
                  {formattedDetails.numbered.map((point, index) => (
                    <li key={`num-${index}`} className="text-sm">{point}</li>
                  ))}
                </ul>
              </div>
            )}
            
            {formattedDetails.bullets && (
              <ul className="list-disc pl-4 space-y-1 text-sm">
                {formattedDetails.bullets.map((point, index) => (
                  <li key={`bullet-${index}`} className="text-sm">{point}</li>
                ))}
              </ul>
            )}
            
            {formattedDetails.suggestions && (
              <div className="space-y-1 bg-accent/20 p-2 rounded-md">
                <p className="font-medium text-sm">Suggestions:</p>
                <ul className="list-none space-y-1 text-sm">
                  {formattedDetails.suggestions.map((suggestion, index) => (
                    <li key={`sug-${index}`} className="text-sm">{suggestion}</li>
                  ))}
                </ul>
              </div>
            )}
            
            {formattedDetails.other && (
              <div className="text-sm space-y-1">
                {formattedDetails.other.map((text, index) => (
                  <p key={`other-${index}`}>{text}</p>
                ))}
              </div>
            )}
          </div>
        );

        // Automatically switch to text input for specific error types
        if (errorMessage.toLowerCase().match(/(paywall|authentication|forbidden|restricted|subscribe)/)) {
          setActiveTab("text");
        }
      } else {
        toastDescription = <p className="text-sm">{errorMessage}</p>;
      }
      
      toast({
        title: "Error",
        description: toastDescription,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Tabs 
      defaultValue="url" 
      className="w-full" 
      value={activeTab}
      onValueChange={(value) => setActiveTab(value as "url" | "text")}
    >
      <TabsList>
        <TabsTrigger value="url">URL</TabsTrigger>
        <TabsTrigger value="text">Direct Text</TabsTrigger>
      </TabsList>
      
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <TabsContent value="url">
            <FormField
              control={form.control}
              name="url"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-black dark:text-white">Article URL</FormLabel>
                  <FormControl>
                    <Input className="text-black dark:text-white"
                      placeholder="https://..." 
                      {...field} 
                      disabled={isLoading}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </TabsContent>
          
          <TabsContent value="text">
            <FormField
              control={form.control}
              name="content"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-black dark:text-white">Article Text</FormLabel>
                  <FormControl>
                    <Textarea className="text-black dark:text-white"
                      placeholder="Paste your article text here..." 
                      {...field}
                      disabled={isLoading}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </TabsContent>
          
          <Button type="submit" disabled={isLoading} className="text-white dark:text-black">
            {isLoading ? "Converting..." : "Convert to Audio"}
          </Button>
        </form>
      </Form>
    </Tabs>
  );
}
