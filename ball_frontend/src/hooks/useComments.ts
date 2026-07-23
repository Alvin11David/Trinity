import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getComments, addComment, deleteComment } from '../api/feed';
import { feedKeys } from './useFeed';

export const commentKeys = {
  forPost: (postId: number) => ['comments', postId] as const,
};

export const useComments = (postId: number) =>
  useQuery({
    queryKey: commentKeys.forPost(postId),
    queryFn: () => getComments(postId),
    enabled: !!postId,
  });

export const useAddComment = (postId: number) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ content, parent }: { content: string; parent?: number | null }) =>
      addComment(postId, content, parent),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: commentKeys.forPost(postId) });
      // comments_count lives on the post
      qc.invalidateQueries({ queryKey: feedKeys.post(postId) });
      qc.invalidateQueries({ queryKey: feedKeys.following });
      qc.invalidateQueries({ queryKey: feedKeys.forYou });
    },
  });
};

export const useDeleteComment = (postId: number) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (commentId: number) => deleteComment(commentId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: commentKeys.forPost(postId) });
      qc.invalidateQueries({ queryKey: feedKeys.post(postId) });
    },
  });
};
