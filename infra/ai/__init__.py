"""AI Router - Intelligent model selection and routing for personal coding environment."""

import os
import yaml
from pathlib import Path
from typing import Dict, List, Optional, Any
from dataclasses import dataclass


@dataclass
class ModelInfo:
    """Information about an available model."""
    
    key: str
    name: str
    provider: str
    cost_class: str
    capabilities: Dict[str, bool]
    quality_score: int
    availability: bool = True
    
    def can_handle_task(self, task_type: str) -> bool:
        """Check if model can handle a specific task type."""
        # Map task type to capability
        capability_map = {
            "implementation": "coding",
            "refactoring": "refactoring",
            "test_generation": "test_generation",
            "debugging": "debugging",
            "code_review": "coding",
            "documentation": "coding",
            "maintenance": "coding",
            "complex_architecture": "architectural_planning",
            "novel_algorithm": "novel_problem_solving",
            "security_critical": "security_review",
        }
        
        required_capability = capability_map.get(task_type, "coding")
        return self.capabilities.get(required_capability, False)


class AIRouter:
    """
    Intelligent AI model router for personal development environment.
    
    Handles:
    - Model selection based on task type and requirements
    - Cost policy enforcement
    - Model availability checking
    - Fallback escalation
    """
    
    def __init__(self, repo_root: Optional[Path] = None):
        """Initialize the AI Router with configuration files."""
        if repo_root is None:
            repo_root = Path(__file__).parent.parent.parent
        
        self.repo_root = repo_root
        self.config_dir = repo_root / "config" / "ai"
        
        # Load configuration
        self.models_config = self._load_yaml(self.config_dir / "models.yaml")
        self.profiles_config = self._load_yaml(self.config_dir / "profiles.yaml")
        self.policy_config = self._load_yaml(self.config_dir / "policy.yaml")
        
        # Parse models
        self.models = self._parse_models()
        
        # Get active profile
        self.profile = self._get_profile()
    
    @staticmethod
    def _load_yaml(path: Path) -> Dict[str, Any]:
        """Load a YAML configuration file."""
        if not path.exists():
            raise FileNotFoundError(f"Configuration file not found: {path}")
        
        with open(path, "r") as f:
            return yaml.safe_load(f)
    
    def _parse_models(self) -> Dict[str, ModelInfo]:
        """Parse model definitions from configuration."""
        models = {}
        
        for key, config in self.models_config.get("models", {}).items():
            model = ModelInfo(
                key=key,
                name=config.get("name", key),
                provider=config.get("provider", "unknown"),
                cost_class=config.get("cost_class", "unknown"),
                capabilities=config.get("capabilities", {}),
                quality_score=config.get("quality", {}).get("average_quality_score", 0),
                availability=self._check_model_availability(key, config),
            )
            models[key] = model
        
        return models
    
    def _check_model_availability(self, model_key: str, config: Dict) -> bool:
        """Check if a model is currently available."""
        if model_key == "qwen":
            # Qwen requires GPU to be running
            return self._check_gpu_availability()
        elif model_key in ("frontier", "claude"):
            # Frontier and Claude require API keys
            if model_key == "frontier":
                return "OPENAI_API_KEY" in os.environ
            else:
                return "ANTHROPIC_API_KEY" in os.environ
        
        return True
    
    def _check_gpu_availability(self) -> bool:
        """Check if Qwen GPU is available."""
        # Check if AI_BASE_URL is configured
        if not os.environ.get("AI_BASE_URL"):
            return False
        
        # Try to ping the endpoint
        try:
            import requests
            response = requests.get(
                os.environ["AI_BASE_URL"] + "/health",
                timeout=5,
            )
            return response.status_code == 200
        except Exception:
            return False
    
    def _get_profile(self) -> str:
        """Get the active profile (from env or default)."""
        return os.environ.get("AI_PROFILE", 
                             self.profiles_config.get("default_profile", "balanced"))
    
    def select_model(
        self,
        task_type: Optional[str] = None,
        require_capability: Optional[str] = None,
        max_cost: Optional[float] = None,
    ) -> Optional[str]:
        """
        Select the best model for a task.
        
        Args:
            task_type: Type of task (e.g., "implementation", "debugging")
            require_capability: Required capability (e.g., "coding")
            max_cost: Maximum cost per task in USD
        
        Returns:
            Model key (e.g., "qwen", "frontier") or None if no suitable model
        """
        # If AI_MODEL is explicitly set, use it
        if os.environ.get("AI_MODEL"):
            return self._get_model_key_for_model_name(os.environ["AI_MODEL"])
        
        # Get profile preferences
        profile_name = self._get_profile()
        profile = self.profiles_config.get("profiles", {}).get(profile_name, {})
        
        # If profile has a specific routing for this task type, use it
        if task_type:
            task_routing = profile.get("task_routing", {})
            if task_type in task_routing:
                preferred = task_routing[task_type]
                if preferred != "auto" and self._is_model_available(preferred):
                    return preferred
        
        # Use profile's preferred model if available
        preferred_model = profile.get("preferred_model", "qwen")
        if preferred_model != "auto" and self._is_model_available(preferred_model):
            if self._model_can_handle_task(preferred_model, task_type):
                return preferred_model
        
        # Auto-select based on cost/quality factors
        return self._auto_select_model(task_type, require_capability, max_cost)
    
    def _get_model_key_for_model_name(self, model_name: str) -> Optional[str]:
        """Get model key from model name (e.g., "Qwen3-Coder-30B" -> "qwen")."""
        for key, model in self.models.items():
            if model.name.lower() in model_name.lower():
                return key
        return None
    
    def _is_model_available(self, model_key: str) -> bool:
        """Check if a model is available."""
        return model_key in self.models and self.models[model_key].availability
    
    def _model_can_handle_task(self, model_key: str, task_type: Optional[str]) -> bool:
        """Check if model can handle a specific task type."""
        if task_type is None:
            return True
        
        model = self.models.get(model_key)
        if model is None:
            return False
        
        return model.can_handle_task(task_type)
    
    def _auto_select_model(
        self,
        task_type: Optional[str] = None,
        require_capability: Optional[str] = None,
        max_cost: Optional[float] = None,
    ) -> Optional[str]:
        """
        Auto-select model based on cost/quality factors.
        
        Uses priority factors from policy configuration.
        """
        available_models = [
            model for model in self.models.values()
            if model.availability and self._model_can_handle_task(model.key, task_type)
        ]
        
        if not available_models:
            return None
        
        # Apply cost constraint
        if max_cost:
            available_models = [
                model for model in available_models
                if self._estimate_task_cost(model.key) <= max_cost
            ]
        
        if not available_models:
            return None
        
        # Score models based on priority factors
        policy = self.policy_config.get("policy", {})
        priority_factors = policy.get("model_selection", {}).get("priority_factors", {})
        
        # Simple scoring: prefer cheaper models first, then better quality
        available_models.sort(
            key=lambda m: (
                self._get_cost_score(m.cost_class),
                -m.quality_score,  # Higher quality is better
            )
        )
        
        return available_models[0].key
    
    def _estimate_task_cost(self, model_key: str) -> float:
        """Estimate cost for a task with given model."""
        model = self.models.get(model_key)
        if model is None:
            return 0.0
        
        model_config = self.models_config.get("models", {}).get(model_key, {})
        return model_config.get("cost", {}).get("average_task_cost", 0.0)
    
    @staticmethod
    def _get_cost_score(cost_class: str) -> int:
        """Convert cost class to numeric score (lower is cheaper)."""
        cost_scores = {
            "very_low": 0,
            "low": 1,
            "medium": 2,
            "high": 3,
            "very_high": 4,
        }
        return cost_scores.get(cost_class, 999)
    
    def get_model_info(self, model_key: str) -> Optional[ModelInfo]:
        """Get information about a specific model."""
        return self.models.get(model_key)
    
    def list_models(self) -> Dict[str, ModelInfo]:
        """List all available models."""
        return self.models
    
    def get_active_profile(self) -> str:
        """Get the currently active profile name."""
        return self._get_profile()
    
    def get_profile_config(self, profile_name: Optional[str] = None) -> Dict:
        """Get configuration for a specific profile."""
        if profile_name is None:
            profile_name = self._get_profile()
        
        return self.profiles_config.get("profiles", {}).get(profile_name, {})


def get_router(repo_root: Optional[Path] = None) -> AIRouter:
    """Factory function to get a configured AI Router instance."""
    return AIRouter(repo_root)
