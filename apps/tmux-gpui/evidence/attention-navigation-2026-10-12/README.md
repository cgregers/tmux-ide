# Attention state retirement before navigation

Hosted Linux run 38216255688 exposed a real ordering defect: the new navigation request was published before retiring the old attention observation. The prior latest-only test could miss the intermediate publication. The regression now checks every publication for Home and Refresh and failed before the fix.

Cancel attention at all five navigation request admission sites before new-request publication. Rejected attention actions retain their existing state; highest scope fences remain intact. Independent parent review approved. Seven focused tests passed; types/lint/diff checks passed. Full bridge gate: 435 passed, five existing optional skips, zero failures.

Source path verified; new exact package and hosted revalidation remain pending. User alpha and production sessions untouched.
