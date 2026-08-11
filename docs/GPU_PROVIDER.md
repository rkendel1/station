# GPU Provider Selection

## Objective

Select a cloud GPU provider that meets the requirements for running an ephemeral GPU inference worker in a personal development environment.

## Evaluation Criteria

1. **Hourly GPU Price** - Cost-effectiveness for personal use
2. **GPU Memory** - Sufficient for Qwen3-Coder 30B (requires 60-80GB VRAM)
3. **Availability** - Consistent GPU availability without excessive wait times
4. **Startup Time** - Fast pod/instance startup for development workflows
5. **Persistent Storage** - Ability to cache models across pod lifecycle
6. **Bandwidth** - Sufficient bandwidth for model downloads and inference
7. **API/Provisioning Support** - Programmatic instance creation and management
8. **Programmatic Destruction** - Ability to terminate instances via API

## Providers Evaluated

### RunPod
- **Hourly Price**: ~$0.27/hr (RTX 4090), ~$1.99/hr (H100)
- **GPU Memory**: 24GB (RTX 4090), 80GB (H100)
- **Availability**: High - extensive GPU inventory
- **Startup Time**: Very fast (< 2 minutes typical)
- **Persistent Storage**: Supported via network storage
- **Bandwidth**: Good - adequate for model transfers
- **API Support**: Excellent - comprehensive REST API and serverless options
- **Programmatic Control**: Full support for pod lifecycle management
- **Strengths**: Reliable all-rounder, excellent for indie developers, fast provisioning
- **Weaknesses**: Slightly higher than absolute minimum pricing

### Vast.ai
- **Hourly Price**: ~$0.25-0.30/hr (RTX 4090), ~$1.80-2.00/hr (H100)
- **GPU Memory**: 24GB (RTX 4090), 80GB (H100), highly configurable
- **Availability**: Variable - marketplace-based, subject to availability
- **Startup Time**: Moderate (2-5 minutes depending on provider)
- **Persistent Storage**: Supported
- **Bandwidth**: Good
- **API Support**: Good - API available for instance management
- **Programmatic Control**: Supported
- **Strengths**: Competitive pricing, marketplace flexibility
- **Weaknesses**: Reliability less predictable, startup can vary, marketplace dynamics

### Lambda Labs
- **Hourly Price**: ~$2.00/hr (H100), competitive with RunPod
- **GPU Memory**: 80GB (H100), 40GB (A100), 24GB (RTX 4090)
- **Availability**: Good but sometimes limited
- **Startup Time**: Fast (< 2 minutes)
- **Persistent Storage**: Supported
- **Bandwidth**: Good
- **API Support**: Good - API available for cluster management
- **Programmatic Control**: Supported
- **Strengths**: Deep learning optimized, researcher-friendly, good documentation
- **Weaknesses**: Less focus on ephemeral/serverless workloads

### Paperspace (DigitalOcean)
- **Hourly Price**: ~$0.29/hr (RTX 4090), ~$2.10/hr (H100)
- **GPU Memory**: 24GB (RTX 4090), 80GB (A100/H100)
- **Availability**: Good
- **Startup Time**: Moderate (2-3 minutes)
- **Persistent Storage**: Supported
- **Bandwidth**: Good
- **API Support**: Good - Gradient API available
- **Programmatic Control**: Supported
- **Strengths**: User-friendly interface, notebook support, good for prototyping
- **Weaknesses**: More optimized for interactive/training workloads than inference

## Selection Rationale

**Selected Provider: RunPod**

RunPod provides the best balance for a personal ephemeral GPU inference workload:

1. **Reliability + Speed**: Combination of consistent availability and fast startup times makes it ideal for development iterations
2. **Cost-Effective**: Pricing is competitive while maintaining reliability (unlike Vast.ai's variable marketplace)
3. **Excellent API**: Serverless API and pod management API are well-documented and stable
4. **Programmatic Control**: Full lifecycle management enables true ephemeral workflows
5. **Community**: Strong indie developer community and good documentation
6. **Inference Focus**: RunPod serverless is optimized for inference workloads like ours

### Alternative for Future Cost Optimization

Vast.ai can serve as a future alternative if cost becomes critical constraint, with trade-off of less predictable startup times and availability.

## Deployment Architecture

RunPod Serverless is used for inference requests, with:
- Model cached in network storage to reduce startup time
- Pod lifecycle managed programmatically
- Worker exposes OpenAI-compatible API during active pod lifecycle

## GPU Configuration

**Target GPU**: NVIDIA H100 (80GB VRAM)
- Sufficient for Qwen3-Coder 30B in fp16 without quantization
- Includes inference overhead and context handling

**Fallback GPU**: NVIDIA RTX 4090 (24GB VRAM)
- Requires model quantization (e.g., int4)
- Lower cost but requires optimized model loading

**Conservative Context Window**: 4096 tokens
- Safe default for 30B model on H100
- Can be increased after testing with actual workload

## Next Steps

1. Set up RunPod API credentials
2. Implement provider abstraction layer in `infra/gpu/provider/runpod.py`
3. Create GPU worker container with vLLM
4. Test model loading and inference latency
5. Optimize context window based on empirical testing
