# Research-Based Spelling Difficulty Model

## Purpose

This app uses a research-informed spelling difficulty score to estimate how structurally demanding a word or test is likely to be to spell.

The score is intended to:

- support test design
- make test difficulty more transparent
- help teachers balance practice and assessment materials

It is not intended to label pupils, infer ability, or drive automated decisions.

## Research Basis

The model is based on four strands from the literature:

1. Spencer (2007) showed that children's spelling difficulty can be predicted from orthographic transparency, phonemic length, graphemic length, and word frequency, with letter-phoneme mismatch playing an important role.
   Source: https://pubmed.ncbi.nlm.nih.gov/17456275/

2. Saha et al. (2021) validated a decoding-difficulty measure using sub-lexical components including letter-sound discrepancy, grapheme-phoneme complexity, and number of blends.
   Source: https://pmc.ncbi.nlm.nih.gov/articles/PMC8011635/

3. Schmalz et al. (2026) reviewed ways of measuring orthographic depth and highlighted the importance of multiletter correspondences, context-sensitive correspondences, and irregularity/unpredictability.
   Source: https://pmc.ncbi.nlm.nih.gov/articles/PMC12804241/

4. Godin et al. (2021) showed that silent letters are a major source of spelling difficulty and should be treated as a meaningful feature rather than noise.
   Source: https://pubmed.ncbi.nlm.nih.gov/34185580/

## Formula Design

The app uses a transparent composite rather than a hidden model.

For each word, the score combines five normalized components:

1. Phonemic length
   Approximate number of phonemes represented by the word's grapheme structure.

2. Letter-sound discrepancy
   The mismatch between written letter count and estimated phoneme count.

3. Grapheme-phoneme complexity
   Multiletter graphemes, split digraphs, context-sensitive graphemes, and graphemes with multiple plausible mappings.

4. Blend load
   Consonant blend or cluster pressure in the word structure.

5. Irregularity load
   Silent-letter patterns, odd orthographic patterns, and any teacher-marked tricky-word flag.

Word frequency is discussed in the research literature and is an important future enhancement, but it is not included in this version because the app does not yet store a validated frequency corpus for classroom spelling words.

The current formula is:

```text
Difficulty score =
  mean(
    phonemic_length,
    letter_sound_discrepancy,
    gpc_complexity,
    blend_load,
    irregularity_load
  ) * 100
```

## Why Equal Weighting?

This choice is deliberate.

The cited research supports the inclusion of these features, but it does not provide a single classroom-standard coefficient set for English school spelling tests. Using an equal-weight composite keeps the model:

- transparent
- auditable
- easy to explain to teachers
- easier to recalibrate later against real pupil outcomes

## How Test Difficulty Is Calculated

Test difficulty is the average of the current word difficulty scores in the test.

That makes the roll-up easy to explain:

- each word receives a structural difficulty score
- the test score is the average of those word scores

## Important Interpretation Note

The score describes the structure of the word set, not the child.

Higher scores suggest that the spelling content itself is more demanding because it contains features such as:

- more complex grapheme-phoneme correspondences
- more blends
- more silent-letter patterns
- more irregular or tricky features

It should be used to support teacher planning, not to rank or label pupils.
