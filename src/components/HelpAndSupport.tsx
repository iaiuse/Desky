import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";

export const HelpAndSupport: React.FC = () => {
  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">帮助与支持</h1>
      <Tabs defaultValue="guide">
        <TabsList>
          <TabsTrigger value="guide">用户指南</TabsTrigger>
          <TabsTrigger value="faq">常见问题</TabsTrigger>
          <TabsTrigger value="feedback">反馈</TabsTrigger>
        </TabsList>
        <TabsContent value="guide">
          <h2 className="text-xl font-semibold mb-2">用户指南</h2>
          {/* Add user guide content here */}
        </TabsContent>
        <TabsContent value="faq">
          <h2 className="text-xl font-semibold mb-2">常见问题</h2>
          {/* Add FAQ content here */}
        </TabsContent>
        <TabsContent value="feedback">
          <h2 className="text-xl font-semibold mb-2">提供反馈</h2>
          {/* Add feedback form here */}
        </TabsContent>
      </Tabs>
    </div>
  );
};