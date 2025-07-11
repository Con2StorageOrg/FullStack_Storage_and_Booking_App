import { useState } from "react";
import { supabase } from "../../config/supabase";

export default function SupabaseDebug() {
  const [testResult, setTestResult] = useState<string>("Not tested");

  const testConnection = async () => {
    try {
      console.log(
        "Testing with anon key:",
        import.meta.env.VITE_SUPABASE_ANON_KEY
          ? `${import.meta.env.VITE_SUPABASE_ANON_KEY.substring(0, 5)}...`
          : "missing",
      );

      // Updated query: Using the proper method for count
      const { count, error } = await supabase
        .from("storage_items")
        .select("*", { count: "exact", head: true });

      if (error) {
        console.error("Supabase test failed:", error);
        setTestResult(
          `Error: ${error.message || "Authentication failed (401)"}`,
        );
      } else {
        // Properly access the count from response
        setTestResult(
          `Connection successful! Items: ${count !== null ? count : "unknown"}`,
        );
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      setTestResult(`Error: ${errMsg}`);
      console.error("Supabase test exception:", err);
    }
  };

  return (
    <div className="p-4 border rounded mt-4">
      <h3 className="font-bold">Supabase Diagnostic</h3>
      <p className="my-2">
        URL: {import.meta.env.VITE_SUPABASE_URL ? "✓ Found" : "❌ Missing"}
        <br />
        Key: {import.meta.env.VITE_SUPABASE_ANON_KEY ? "✓ Found" : "❌ Missing"}
      </p>
      <div className="my-2">Test result: {testResult}</div>
      <button
        onClick={testConnection}
        className="px-4 py-2 bg-blue-500 text-white rounded"
      >
        Test Supabase Connection
      </button>
    </div>
  );
}
