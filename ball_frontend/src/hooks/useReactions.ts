import { useMutation, useQueryClient, type InfiniteData } from '@tanstack/react-query';
import { reactToPost, type ReactionType, type Post, type Paginated } from '../api/feed';
import { feedKeys } from './useFeed';

type FeedData = InfiniteData<Paginated<Post>>;

function patchPost(p: Post, postId: number, reactionType: ReactionType): Post {
  if (p.id !== postId) return p;
  const wasSame = p.user_reaction === reactionType;
  const hadReaction = p.user_reaction != null;
  const nextReaction = wasSame ? null : reactionType;
  let count = p.reactions_count;
  if (wasSame) count -= 1; // toggled off
  else if (!hadReaction) count += 1; // added new (switching type leaves count)
  return { ...p, user_reaction: nextReaction, reactions_count: Math.max(count, 0) };
}

function patchFeed(data: FeedData | undefined, postId: number, type: ReactionType): FeedData | undefined {
  if (!data) return data;
  return {
    ...data,
    pages: data.pages.map((pg) => ({
      ...pg,
      results: pg.results.map((p) => patchPost(p, postId, type)),
    })),
  };
}

/**
 * Toggle a reaction on a post. Optimistically patches both infinite feed caches
 * and the single-post cache, reconciling with the server on settle.
 * Server semantics: same type again -> removed; different -> updated; none -> reacted.
 */
export const useReactToPost = () => {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: ({ postId, reactionType }: { postId: number; reactionType: ReactionType }) =>
      reactToPost(postId, reactionType),

    onMutate: async ({ postId, reactionType }) => {
      await qc.cancelQueries({ queryKey: feedKeys.following });
      await qc.cancelQueries({ queryKey: feedKeys.forYou });

      const prev = {
        following: qc.getQueryData<FeedData>(feedKeys.following),
        forYou: qc.getQueryData<FeedData>(feedKeys.forYou),
        post: qc.getQueryData<Post>(feedKeys.post(postId)),
      };

      qc.setQueryData<FeedData>(feedKeys.following, (d) => patchFeed(d, postId, reactionType));
      qc.setQueryData<FeedData>(feedKeys.forYou, (d) => patchFeed(d, postId, reactionType));
      qc.setQueryData<Post>(feedKeys.post(postId), (p) => (p ? patchPost(p, postId, reactionType) : p));
      return prev;
    },

    onError: (_err, { postId }, ctx) => {
      if (!ctx) return;
      qc.setQueryData(feedKeys.following, ctx.following);
      qc.setQueryData(feedKeys.forYou, ctx.forYou);
      qc.setQueryData(feedKeys.post(postId), ctx.post);
    },

    onSettled: (_data, _err, { postId }) => {
      qc.invalidateQueries({ queryKey: feedKeys.post(postId) });
    },
  });
};
