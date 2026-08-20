"""
Geometry Decomposer Module for PGD-PINN
Converts STL/OBJ mesh files into geometric tokens for efficient neural operator processing.
Implements precomputed geometry decomposition as per PGD-NO architecture.
"""

import numpy as np
import torch
from typing import Dict, List, Tuple, Optional
from dataclasses import dataclass
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ============================================================================
# Data Structures
# ============================================================================

@dataclass
class GeometricToken:
    """Represents a decomposed geometric region (token)"""
    token_id: int
    centroid: np.ndarray  # (3,) center of mass
    vertices: np.ndarray  # (N, 3) vertices in this token
    faces: np.ndarray  # (M, 3) face indices
    normal_mean: np.ndarray  # (3,) mean surface normal
    curvature: float  # mean curvature
    boundary_type: str  # 'interior', 'wall', 'inlet', 'outlet', 'symmetry'
    
    def to_tensor(self, device: str = 'cpu') -> Dict[str, torch.Tensor]:
        """Convert to PyTorch tensors for neural network input"""
        return {
            'centroid': torch.tensor(self.centroid, dtype=torch.float32, device=device),
            'normal': torch.tensor(self.normal_mean, dtype=torch.float32, device=device),
            'curvature': torch.tensor([self.curvature], dtype=torch.float32, device=device),
        }

@dataclass
class MeshData:
    """Container for mesh information"""
    vertices: np.ndarray  # (N, 3)
    faces: np.ndarray  # (M, 3)
    normals: np.ndarray  # (M, 3) face normals
    boundary_conditions: Dict[str, np.ndarray]  # mapping region names to vertex indices

# ============================================================================
# Geometry Decomposer
# ============================================================================

class GeometryDecomposer:
    """
    Decomposes 3D mesh geometries into geometric tokens for efficient processing.
    Inspired by PGD-NO's precomputed geometry decomposition strategy.
    """
    
    def __init__(self, num_tokens: int = 64, device: str = 'cpu'):
        """
        Initialize the decomposer.
        
        Args:
            num_tokens: Number of geometric tokens to create (default: 64)
            device: 'cpu' or 'cuda'
        """
        self.num_tokens = num_tokens
        self.device = device
        self.tokens: List[GeometricToken] = []
    
    def load_mesh(self, mesh_path: str) -> MeshData:
        """
        Load mesh from STL or OBJ file.
        
        Args:
            mesh_path: Path to STL or OBJ file
            
        Returns:
            MeshData object
        """
        logger.info(f"Loading mesh from {mesh_path}")
        
        if mesh_path.endswith('.stl'):
            return self._load_stl(mesh_path)
        elif mesh_path.endswith('.obj'):
            return self._load_obj(mesh_path)
        else:
            raise ValueError(f"Unsupported mesh format: {mesh_path}")
    
    def _load_stl(self, path: str) -> MeshData:
        """Load STL file (binary or ASCII)"""
        try:
            # Try binary STL first
            with open(path, 'rb') as f:
                f.read(80)  # Skip header
                num_triangles = np.frombuffer(f.read(4), dtype=np.uint32)[0]
                triangles = []
                for _ in range(num_triangles):
                    normal = np.frombuffer(f.read(12), dtype=np.float32)
                    v1 = np.frombuffer(f.read(12), dtype=np.float32)
                    v2 = np.frombuffer(f.read(12), dtype=np.float32)
                    v3 = np.frombuffer(f.read(12), dtype=np.float32)
                    f.read(2)  # Skip attribute byte count
                    triangles.append((v1, v2, v3, normal))
            
            vertices = []
            faces = []
            normals = []
            
            for i, (v1, v2, v3, normal) in enumerate(triangles):
                idx_start = len(vertices)
                vertices.extend([v1, v2, v3])
                faces.append([idx_start, idx_start + 1, idx_start + 2])
                normals.append(normal)
            
            vertices = np.array(vertices, dtype=np.float32)
            faces = np.array(faces, dtype=np.int32)
            normals = np.array(normals, dtype=np.float32)
            
            logger.info(f"Loaded STL: {len(vertices)} vertices, {len(faces)} faces")
            
            return MeshData(
                vertices=vertices,
                faces=faces,
                normals=normals,
                boundary_conditions={}
            )
        except Exception as e:
            logger.error(f"Failed to load STL: {e}")
            raise
    
    def _load_obj(self, path: str) -> MeshData:
        """Load OBJ file"""
        vertices = []
        faces = []
        normals = []
        
        with open(path, 'r') as f:
            for line in f:
                if line.startswith('v '):
                    vertices.append(list(map(float, line.split()[1:4])))
                elif line.startswith('vn '):
                    normals.append(list(map(float, line.split()[1:4])))
                elif line.startswith('f '):
                    face = []
                    for vertex_data in line.split()[1:]:
                        indices = vertex_data.split('/')
                        face.append(int(indices[0]) - 1)  # OBJ uses 1-based indexing
                    if len(face) == 3:
                        faces.append(face)
        
        vertices = np.array(vertices, dtype=np.float32)
        faces = np.array(faces, dtype=np.int32)
        
        # Compute normals if not provided
        if not normals:
            normals = self._compute_normals(vertices, faces)
        else:
            normals = np.array(normals, dtype=np.float32)
        
        logger.info(f"Loaded OBJ: {len(vertices)} vertices, {len(faces)} faces")
        
        return MeshData(
            vertices=vertices,
            faces=faces,
            normals=normals,
            boundary_conditions={}
        )
    
    def _compute_normals(self, vertices: np.ndarray, faces: np.ndarray) -> np.ndarray:
        """Compute face normals using cross product"""
        normals = []
        for face in faces:
            v0, v1, v2 = vertices[face]
            edge1 = v1 - v0
            edge2 = v2 - v0
            normal = np.cross(edge1, edge2)
            norm = np.linalg.norm(normal)
            if norm > 1e-6:
                normal = normal / norm
            normals.append(normal)
        return np.array(normals, dtype=np.float32)
    
    def decompose(self, mesh: MeshData) -> List[GeometricToken]:
        """
        Decompose mesh into geometric tokens using K-means clustering on face centroids.
        
        Args:
            mesh: MeshData object
            
        Returns:
            List of GeometricToken objects
        """
        logger.info(f"Decomposing mesh into {self.num_tokens} tokens")
        
        # Compute face centroids
        face_centroids = []
        for face in mesh.faces:
            centroid = mesh.vertices[face].mean(axis=0)
            face_centroids.append(centroid)
        face_centroids = np.array(face_centroids)
        
        # K-means clustering
        from sklearn.cluster import KMeans
        kmeans = KMeans(n_clusters=self.num_tokens, random_state=42, n_init=10)
        labels = kmeans.fit_predict(face_centroids)
        
        # Create tokens
        self.tokens = []
        for token_id in range(self.num_tokens):
            mask = labels == token_id
            token_faces = mesh.faces[mask]
            
            if len(token_faces) == 0:
                continue
            
            # Collect vertices for this token
            token_vertex_indices = np.unique(token_faces.flatten())
            token_vertices = mesh.vertices[token_vertex_indices]
            
            # Compute token properties
            centroid = token_vertices.mean(axis=0)
            normal_mean = mesh.normals[mask].mean(axis=0)
            normal_mean = normal_mean / (np.linalg.norm(normal_mean) + 1e-6)
            
            # Compute mean curvature (simplified: use variance of normals)
            curvature = np.linalg.norm(mesh.normals[mask].std(axis=0))
            
            token = GeometricToken(
                token_id=token_id,
                centroid=centroid,
                vertices=token_vertices,
                faces=token_faces,
                normal_mean=normal_mean,
                curvature=float(curvature),
                boundary_type='interior'  # Will be refined based on boundary conditions
            )
            self.tokens.append(token)
        
        logger.info(f"Created {len(self.tokens)} tokens")
        return self.tokens
    
    def assign_boundary_conditions(self, mesh: MeshData, bc_dict: Dict[str, List[int]]):
        """
        Assign boundary condition types to tokens based on vertex membership.
        
        Args:
            mesh: MeshData object
            bc_dict: Dict mapping boundary type names to lists of vertex indices
        """
        for token in self.tokens:
            token_vertex_indices = np.unique(token.faces.flatten())
            
            for bc_type, bc_vertices in bc_dict.items():
                overlap = len(np.intersect1d(token_vertex_indices, bc_vertices))
                if overlap / len(token_vertex_indices) > 0.5:  # >50% overlap
                    token.boundary_type = bc_type
                    break
    
    def get_token_embeddings(self) -> torch.Tensor:
        """
        Get all token embeddings as a tensor for neural network input.
        
        Returns:
            Tensor of shape (num_tokens, embedding_dim)
        """
        embeddings = []
        for token in self.tokens:
            embedding = np.concatenate([
                token.centroid,  # 3D
                token.normal_mean,  # 3D
                [token.curvature],  # 1D
            ])
            embeddings.append(embedding)
        
        embeddings = np.array(embeddings, dtype=np.float32)
        return torch.tensor(embeddings, dtype=torch.float32, device=self.device)
    
    def get_token_attention_mask(self) -> torch.Tensor:
        """
        Get attention mask for token interactions (spatial proximity).
        
        Returns:
            Tensor of shape (num_tokens, num_tokens)
        """
        num_tokens = len(self.tokens)
        mask = np.zeros((num_tokens, num_tokens), dtype=np.float32)
        
        # Compute pairwise distances between token centroids
        centroids = np.array([t.centroid for t in self.tokens])
        distances = np.linalg.norm(centroids[:, np.newaxis] - centroids[np.newaxis, :], axis=2)
        
        # Gaussian kernel for attention
        sigma = distances.max() / 3.0  # Bandwidth
        mask = np.exp(-(distances ** 2) / (2 * sigma ** 2))
        
        return torch.tensor(mask, dtype=torch.float32, device=self.device)

# ============================================================================
# Utility Functions
# ============================================================================

def decompose_geometry(mesh_path: str, num_tokens: int = 64, device: str = 'cpu') -> Tuple[torch.Tensor, torch.Tensor]:
    """
    Convenience function to decompose a mesh file.
    
    Args:
        mesh_path: Path to STL or OBJ file
        num_tokens: Number of tokens
        device: 'cpu' or 'cuda'
        
    Returns:
        (token_embeddings, attention_mask) tensors
    """
    decomposer = GeometryDecomposer(num_tokens=num_tokens, device=device)
    mesh = decomposer.load_mesh(mesh_path)
    tokens = decomposer.decompose(mesh)
    
    embeddings = decomposer.get_token_embeddings()
    attention_mask = decomposer.get_token_attention_mask()
    
    return embeddings, attention_mask, tokens
