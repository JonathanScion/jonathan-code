import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, FolderOpen } from 'lucide-react';
import { collectionsApi } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { formatDate } from '@/lib/utils';

export function CollectionsPage() {
  const queryClient = useQueryClient();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newCollection, setNewCollection] = useState({ name: '', description: '' });

  const { data: collections, isLoading } = useQuery({
    queryKey: ['collections'],
    queryFn: collectionsApi.getAll,
  });

  const createMutation = useMutation({
    mutationFn: collectionsApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['collections'] });
      setIsCreateModalOpen(false);
      setNewCollection({ name: '', description: '' });
    },
  });

  const handleCreate = () => {
    createMutation.mutate({
      name: newCollection.name,
      description: newCollection.description,
      imageIds: [],
      isPublic: false,
    });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-dark mb-2">Collections</h1>
            <p className="text-dark-light">Organize your images into collections</p>
          </div>
          <Button onClick={() => setIsCreateModalOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            New Collection
          </Button>
        </div>

        {isLoading && (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
          </div>
        )}

        {collections && collections.length === 0 && (
          <div className="text-center py-20">
            <FolderOpen className="w-16 h-16 text-dark-light mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-dark mb-2">No collections yet</h3>
            <p className="text-dark-light mb-6">Create your first collection to organize images</p>
            <Button onClick={() => setIsCreateModalOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Create Collection
            </Button>
          </div>
        )}

        {collections && collections.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {collections.map((collection) => (
              <Link key={collection.id} to={`/collection/${collection.id}`}>
                <Card hover>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="p-2 bg-primary-50 rounded-eoi mb-3">
                        <FolderOpen className="w-6 h-6 text-primary" />
                      </div>
                      <span className="text-xs text-dark-light">
                        {collection.imageIds.length} images
                      </span>
                    </div>
                    <CardTitle>{collection.name}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-dark-light text-sm mb-4 line-clamp-2">
                      {collection.description || 'No description'}
                    </p>
                    <div className="flex items-center text-xs text-dark-light">
                      <span>Updated {formatDate(collection.updatedAt)}</span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>

      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Create New Collection"
      >
        <div className="space-y-4">
          <Input
            label="Collection Name"
            value={newCollection.name}
            onChange={(e) => setNewCollection({ ...newCollection, name: e.target.value })}
            placeholder="My Collection"
          />
          <div>
            <label className="block text-sm font-medium text-dark mb-1">Description</label>
            <textarea
              className="w-full px-3 py-2 border border-light-border rounded-eoi focus:outline-none focus:ring-2 focus:ring-primary"
              rows={3}
              value={newCollection.description}
              onChange={(e) => setNewCollection({ ...newCollection, description: e.target.value })}
              placeholder="Optional description"
            />
          </div>
          <div className="flex space-x-2">
            <Button variant="outline" onClick={() => setIsCreateModalOpen(false)} className="flex-1">
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              className="flex-1"
              isLoading={createMutation.isPending}
              disabled={!newCollection.name}
            >
              Create
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
