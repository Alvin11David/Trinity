import { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Pressable, Animated, PanResponder, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { PinnedMessage } from '../../api/chat';
import { getPinPositions, savePinPosition, type PinPosition } from '../../lib/pinPositions';
import { useThemeColors } from '../../hooks/useThemeColors';

const PILL_H = 40;
const DEFAULT_MARGIN = 12;

function shortName(name: string) {
  return (name || '').trim().slice(0, 3).toUpperCase();
}

function pillContent(pin: PinnedMessage, c: ReturnType<typeof useThemeColors>): { dot: string; primary: string; secondary: string } {
  const m = pin.message;
  if (m.message_type === 'match_card' && m.match_card) {
    const match = m.match_card;
    const live = match.status === 'live';
    const showScore = match.status === 'live' || match.status === 'finished';
    return {
      dot: live ? c.primary : match.status === 'finished' ? c.muted : c.yellow500,
      primary: `${shortName(match.home_team)} ${showScore ? `${match.home_score ?? 0}-${match.away_score ?? 0}` : 'v'} ${shortName(match.away_team)}`,
      secondary: live ? `${match.minute ?? 0}'` : match.status === 'finished' ? 'FT' : 'soon',
    };
  }
  if (m.message_type === 'prediction_card') {
    return { dot: c.primary, primary: 'Winnie pick', secondary: m.prediction_card?.match.home_team ?? '' };
  }
  if (m.message_type === 'poll') {
    return { dot: c.blue500, primary: 'Poll', secondary: (m.content || m.poll?.options.join(' / ') || '').slice(0, 24) };
  }
  return {
    dot: c.muted,
    primary: m.sender.username,
    secondary: (m.content || '').slice(0, 28),
  };
}

function DraggablePin({
  pin,
  index,
  bounds,
  initial,
  canManage,
  onJump,
  onUnpin,
  onPersist,
}: {
  pin: PinnedMessage;
  index: number;
  bounds: { w: number; h: number };
  initial: PinPosition | null;
  canManage: boolean;
  onJump: () => void;
  onUnpin: () => void;
  onPersist: (pos: PinPosition) => void;
}) {
  const c = useThemeColors();
  const start = initial ?? { x: DEFAULT_MARGIN, y: DEFAULT_MARGIN + index * (PILL_H + 8) };
  const pan = useRef(new Animated.ValueXY(start)).current;
  const size = useRef({ w: 160, h: PILL_H });

  const clamp = (x: number, y: number): PinPosition => {
    const maxX = Math.max(0, bounds.w - size.current.w);
    const maxY = Math.max(0, bounds.h - size.current.h);
    return { x: Math.min(Math.max(0, x), maxX), y: Math.min(Math.max(0, y), maxY) };
  };

  const responder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 4 || Math.abs(g.dy) > 4,
      onPanResponderGrant: () => {
        pan.setOffset({ x: (pan.x as any)._value, y: (pan.y as any)._value });
        pan.setValue({ x: 0, y: 0 });
      },
      onPanResponderMove: Animated.event([null, { dx: pan.x, dy: pan.y }], {
        useNativeDriver: false,
      }),
      onPanResponderRelease: () => {
        pan.flattenOffset();
        const clamped = clamp((pan.x as any)._value, (pan.y as any)._value);
        Animated.spring(pan, { toValue: clamped, useNativeDriver: false, friction: 8 }).start();
        onPersist(clamped);
      },
    }),
  ).current;

  const pinContent = pillContent(pin, c);

  return (
    <Animated.View
      {...responder.panHandlers}
      onLayout={(e) => {
        size.current = { w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height };
      }}
      style={[styles.pill, { transform: pan.getTranslateTransform(), backgroundColor: c.gray800, borderColor: c.gray700 }]}
    >
      <Pressable onPress={onJump} className="flex-row items-center gap-1.5 flex-1" hitSlop={4}>
        <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: pinContent.dot }} />
        <View className="flex-shrink">
          <Text className="text-text text-[11px] font-bold" numberOfLines={1}>
            {pinContent.primary}
          </Text>
          {!!pinContent.secondary && (
            <Text className="text-textMuted text-[9px]" numberOfLines={1}>
              {pinContent.secondary}
            </Text>
          )}
        </View>
      </Pressable>
      {canManage && (
        <Pressable onPress={onUnpin} hitSlop={8} className="ml-1">
          <Ionicons name="close-circle" size={15} color={c.muted} />
        </Pressable>
      )}
    </Animated.View>
  );
}

export function PinnedOverlay({
  conversationId,
  pins,
  canManage,
  onJump,
  onUnpin,
}: {
  conversationId: number;
  pins: PinnedMessage[];
  canManage: boolean;
  onJump: (messageId: number) => void;
  onUnpin: (messageId: number) => void;
}) {
  const [bounds, setBounds] = useState({ w: 0, h: 0 });
  const [positions, setPositions] = useState<Record<string, PinPosition>>({});

  useEffect(() => {
    let active = true;
    getPinPositions(conversationId).then((p) => active && setPositions(p));
    return () => {
      active = false;
    };
  }, [conversationId]);

  const content = useMemo(() => pins.slice(0, 5), [pins]);
  if (content.length === 0) return null;

  return (
    <View
      pointerEvents="box-none"
      style={StyleSheet.absoluteFill}
      onLayout={(e) => setBounds({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
    >
      {bounds.w > 0 &&
        content.map((pin, i) => (
          <DraggablePin
            key={pin.id}
            pin={pin}
            index={i}
            bounds={bounds}
            initial={positions[String(pin.message.id)] ?? null}
            canManage={canManage}
            onJump={() => onJump(pin.message.id)}
            onUnpin={() => onUnpin(pin.message.id)}
            onPersist={(pos) => savePinPosition(conversationId, pin.message.id, pos)}
          />
        ))}
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    maxWidth: 200,
    minHeight: PILL_H,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 6,
  },
});
