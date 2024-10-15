import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";

export const HelpAndSupport: React.FC = () => {
  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Help & Support</h1>
      <Tabs defaultValue="guide">
        <TabsList>
          <TabsTrigger value="guide">User Guide</TabsTrigger>
          <TabsTrigger value="faq">FAQ</TabsTrigger>
          <TabsTrigger value="feedback">Feedback</TabsTrigger>
        </TabsList>
        <TabsContent value="guide">
          <h2 className="text-xl font-semibold mb-2">User Guide</h2>
          {/* Add user guide content here */}
        </TabsContent>
        <TabsContent value="faq">
          <h2 className="text-xl font-semibold mb-2">Frequently Asked Questions</h2>
          {/* Add FAQ content here */}
        </TabsContent>
        <TabsContent value="feedback">
          <h2 className="text-xl font-semibold mb-2">Provide Feedback</h2>
          {/* Add feedback form here */}
        </TabsContent>
      </Tabs>
    </div>
  );
};