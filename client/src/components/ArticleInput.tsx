import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { convertArticle } from "../lib/api";

const formSchema = z.object({
  url: z.string().url().optional(),
  content: z.string().min(10).optional(),
}).refine((data) => data.url || data.content, {
  message: "Either URL or content must be provided",
});

export default function ArticleInput({ onConvert }: { onConvert: () => void }) {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      url: "",
      content: "",
    },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
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
      toast({
        title: "Error",
        description: "Failed to convert article",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Tabs defaultValue="url" className="w-full">
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
                  <FormLabel>Article URL</FormLabel>
                  <FormControl>
                    <Input placeholder="https://..." {...field} />
                  </FormControl>
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
                  <FormLabel>Article Text</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Paste your article text here..." {...field} />
                  </FormControl>
                </FormItem>
              )}
            />
          </TabsContent>
          
          <Button type="submit" disabled={isLoading}>
            {isLoading ? "Converting..." : "Convert to Audio"}
          </Button>
        </form>
      </Form>
    </Tabs>
  );
}
