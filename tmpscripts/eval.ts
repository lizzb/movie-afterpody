import { supabaseAdmin } from "../src/integrations/supabase/client.server";
import { evaluateMatcher } from "../src/lib/matcher-eval.server";
const a = await evaluateMatcher(supabaseAdmin, { strategy: null, podcastId: null });
const b = await evaluateMatcher(supabaseAdmin, { strategy: "stricter_threshold", podcastId: null });
console.log("live", a.labelledPairs, a.threshold, a.precisionAtThreshold, a.recallAtThreshold);
console.log("strict", b.labelledPairs, b.threshold, b.precisionAtThreshold, b.recallAtThreshold);
