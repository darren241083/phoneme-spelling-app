# Spelling Attainment Indicator

## What this measures

The Spelling Attainment Indicator estimates current spelling level on the app's difficulty scale.

It is designed to:

- estimate current spelling level from checked responses
- support teaching and review
- stay separate from judgement, diagnosis, or fixed labelling

## Level descriptors

- Not yet banded: not enough checked work yet to estimate a spelling level
- Foundations: working with simpler spelling patterns and more predictable words
- Core patterns: working with common spelling patterns used in everyday words
- Expanding patterns: working with more complex patterns, including longer words and less obvious spellings
- Advanced patterns: working with the most demanding spellings in this model

## Performance descriptors

- Building profile: the app is still building enough evidence to judge consistency at this level
- Emerging: often getting words wrong at this level
- Developing: getting some words correct at this level, but not consistently yet
- Secure: usually correct at this level
- Mastered: consistently accurate and reliable at this level

## Evidence labels

- Building evidence: fewer than 10 checked responses, or the estimate is still provisional
- Secure evidence: at least 10 checked responses with controlled model uncertainty
- Strong evidence: at least 18 checked responses with low model uncertainty

## What SAI means

SAI is the score used to calculate the reported spelling level.

The raw score remains visible as supporting detail for review and comparison, but it is not the main headline.

## How it works (short version)

The app gives each checked word a core structural difficulty score.

The current implementation then applies a Rasch-style one-parameter logistic estimate to correct and incorrect responses against those core difficulty values.

The result is translated into:

- a descriptor-led spelling level
- a performance descriptor
- a supporting SAI score
- an evidence label
- a score range where available

Accuracy, first try, completion, and average tries stay visible as companion measures, but they are not blended into the core attainment estimate.

## What is not included

- completion, first try, and average tries do not change the core attainment estimate
- contextual planning modifiers do not change the core structural difficulty used for attainment
- the indicator is not a grade, diagnosis, or fixed label

## Research References

- Rasch (1960). Probabilistic models for some intelligence and attainment tests.
- Spencer (2007). Predicting children's word-spelling difficulty for common English words from measures of orthographic transparency, phonemic and graphemic length and word frequency.
- Saha et al. (2021). A computational model quantifies the influence of sublexical complexity on reading difficulty.
- Godin et al. (2021). Silent letters are a major source of spelling difficulty and should be modelled explicitly.
- Schmalz et al. (2026). Orthographic depth is better described through complexity and unpredictability, including multiletter and context-sensitive correspondences.
