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
      
      // Enhanced error handling with helpful suggestions
      let toastDescription = errorMessage;
      if (errorMessage.includes('paywall') || errorMessage.includes('premium') || 
          errorMessage.includes('subscriber') || errorMessage.includes('authentication')) {
        toastDescription = `${errorMessage}\n\nTip: Try using the direct text input method instead.`;
        // Switch to text input tab
        setActiveTab("text");
      } else if (errorMessage.includes('URL')) {
        toastDescription = `${errorMessage}\n\nPlease ensure the URL is complete and starts with http:// or https://`;
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
