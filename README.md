# RealityCheck

**Check before you trust, pay, or share sensitive information.**

RealityCheck is a LINE-first public safety tool that helps people review suspicious images, videos, audio, screenshots, and messages before making important decisions.

The goal is simple:

> Help people pause, check, and verify before they trust, transfer money, or share sensitive information.

## Why RealityCheck exists

AI-generated media, impersonation, phishing, romance scams, investment scams, and social engineering are becoming easier to create and harder for ordinary users to recognize.

RealityCheck is designed for people who may not have technical knowledge but still need a simple way to ask:

- Is this message suspicious?
- Could this image, video, or voice be manipulated?
- Should I trust this request?
- What should I do before sending money or information?

The product is especially intended to reduce friction for families, older adults, and everyday LINE users who may encounter suspicious content in normal conversations.

## MVP Scope

The first version will focus on:

- Suspicious text and scam-message analysis
- Screenshot analysis
- Image review
- Simple risk explanations
- Safe next-step recommendations
- LINE MINI App integration

Later versions may add:

- Audio / voice-clone review
- Video / deepfake review
- Trusted family sharing
- Advanced verification workflows
- Partner API / white-label integration

## How results are presented

RealityCheck does **not** claim to determine with absolute certainty whether content is real or fake.

Results are designed as decision support, using simple risk levels such as:

- Low apparent risk
- Uncertain — verify further
- High risk — pause before acting

When risk is material, RealityCheck recommends safer actions such as:

- Do not transfer money yet
- Do not share OTPs, PINs, passwords, or banking credentials
- Contact the person using a known phone number or official channel
- Verify the request independently before acting

## Safety Principles

1. **No false certainty**  
   The system should not present uncertain analysis as fact.

2. **Human decision remains final**  
   RealityCheck supports decisions; it does not replace human judgment.

3. **Minimize sensitive data collection**  
   The product should request only the data necessary to perform the check.

4. **Safe action over technical scores**  
   Users should receive clear guidance, not only detector probabilities.

5. **Privacy by default**  
   Uploaded content should not be retained longer than necessary unless the user explicitly consents.

## Product Direction

RealityCheck is being developed as:

- A public web application
- A LINE MINI App
- A future API / partner integration layer

The initial public service is intended to remain simple and accessible, while future sustainability may come from family features, institutional partnerships, APIs, or white-label deployments.

## Current Status

**Status:** Early MVP / Active Development

Current work:

- [x] LINE MINI App channel created
- [x] Initial public repository created
- [ ] Web MVP
- [ ] Text / screenshot risk analysis
- [ ] Image review
- [ ] LINE MINI App endpoint integration
- [ ] Privacy policy
- [ ] Small-user pilot
- [ ] Evaluation and safety testing

## Project Philosophy

> **Stop. Check. Verify. Then act.**

RealityCheck is built around one outcome:

**Help people make safer decisions before harm occurs.**
