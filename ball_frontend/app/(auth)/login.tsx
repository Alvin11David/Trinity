import { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router, type Href } from 'expo-router';
import { useAuthStore } from '../../src/store/authStore';
import { useThemeColors } from '../../src/hooks/useThemeColors';

/* ─── Floating-label input ─────────────────────────────────────────────── */
function FloatInput({
  label,
  value,
  onChangeText,
  secureTextEntry,
  autoCapitalize,
  autoCorrect,
  autoComplete,
  suffix,
}: {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  secureTextEntry?: boolean;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  autoCorrect?: boolean;
  autoComplete?: string;
  suffix?: React.ReactNode;
}) {
  const [focused, setFocused] = useState(false);
  const lifted = focused || value.length > 0;
  const c = useThemeColors();

  return (
    <View style={{ position: 'relative' }}>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        secureTextEntry={secureTextEntry}
        autoCapitalize={autoCapitalize}
        autoCorrect={autoCorrect}
        autoComplete={autoComplete as any}
        placeholder=" "
        placeholderTextColor="transparent"
        style={{
          width: '100%',
          borderRadius: 12,
          paddingHorizontal: 16,
          paddingTop: lifted ? 28 : 14,
          paddingBottom: lifted ? 10 : 14,
          fontSize: 14,
          fontWeight: '500',
          color: c.text,
          backgroundColor: c.surface,
          borderWidth: 1.5,
          borderColor: focused ? c.primary : c.border,
          ...(focused ? { shadowColor: c.primary, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.12, shadowRadius: 8, elevation: 0 } : {}),
        }}
      />
      {/* Floating label */}
      <Text
        style={{
          position: 'absolute',
          left: 16,
          top: lifted ? 8 : 14,
          fontSize: lifted ? 11 : 14,
          fontWeight: '500',
          color: focused ? c.primary : c.muted,
          transform: [{ scale: lifted ? 0.85 : 1 }],
          transformOrigin: 'left',
        }}
        pointerEvents="none"
      >
        {label}
      </Text>
      {suffix ? (
        <View style={{ position: 'absolute', right: 14, top: 0, bottom: 0, justifyContent: 'center' }}>
          {suffix}
        </View>
      ) : null}
    </View>
  );
}

export default function LoginScreen() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const login = useAuthStore((state) => state.login);
  const c = useThemeColors();

  const slideAnim = useRef(new Animated.Value(24)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(slideAnim, { toValue: 0, duration: 500, useNativeDriver: true }),
      Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
    ]).start();
  }, []);

  const handleLogin = async () => {
    setError('');
    if (!username || !password) {
      setError('Please fill in all fields.');
      return;
    }
    setLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      await login(username, password);
      router.replace('/(main)/(app)/(tabs)' as Href);
    } catch {
      setError('Invalid username or password. Please try again.');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, padding: 24, justifyContent: 'center' }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Slide-in wrapper */}
          <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
            {/* Mobile Logo */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 32 }}>
              <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: c.primary, alignItems: 'center', justifyContent: 'center', shadowColor: c.primary, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 4, elevation: 4 }}>
                <Text style={{ color: '#fff', fontWeight: '900', fontSize: 17 }}>B</Text>
              </View>
              <Text style={{ fontSize: 22, fontWeight: '800', color: c.text, letterSpacing: -0.5 }}>Ball</Text>
            </View>

            {/* Heading */}
            <Text style={{ fontSize: 28, fontWeight: '800', color: c.text, marginBottom: 4, letterSpacing: -0.5 }}>Welcome back</Text>
            <Text style={{ fontSize: 14, fontWeight: '500', color: c.muted, marginBottom: 32 }}>Sign in to continue to Ball.</Text>

            {/* Error */}
            {error ? (
              <View style={{
                flexDirection: 'row',
                alignItems: 'flex-start',
                gap: 10,
                backgroundColor: c.isDark ? '#450a0a' : '#fef2f2',
                borderWidth: 1,
                borderColor: c.isDark ? '#b91c1c' : '#fecaca',
                borderRadius: 12,
                paddingHorizontal: 16,
                paddingVertical: 12,
                marginBottom: 24,
              }}>
                <Text style={{ marginTop: 2, fontSize: 14 }}>⚠</Text>
                <Text style={{ flex: 1, color: c.isDark ? '#f87171' : '#b91c1c', fontSize: 14, fontWeight: '500' }}>{error}</Text>
              </View>
            ) : null}

            {/* Username — floating label */}
            <View style={{ marginBottom: 16 }}>
              <FloatInput
                label="Username"
                value={username}
                onChangeText={setUsername}
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="username"
              />
            </View>

            {/* Password — floating label */}
            <View style={{ marginBottom: 8 }}>
              <FloatInput
                label="Password"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="current-password"
                suffix={
                  <TouchableOpacity
                    onPress={() => setShowPassword(!showPassword)}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    style={{ padding: 2 }}
                  >
                    <Ionicons
                      name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                      size={16}
                      color={c.muted}
                    />
                  </TouchableOpacity>
                }
              />
            </View>

            {/* Forgot password */}
            <View style={{ alignItems: 'flex-end', marginBottom: 24 }}>
              <TouchableOpacity onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push('/(auth)/forgot-password' as Href); }}>
                <Text style={{ fontSize: 12, fontWeight: '600', color: c.primary }}>Forgot password?</Text>
              </TouchableOpacity>
            </View>

            {/* Sign In Button — glowing CTA */}
            <TouchableOpacity
              style={{
                backgroundColor: loading ? c.primaryHover : c.primary,
                borderRadius: 12,
                paddingVertical: 14,
                alignItems: 'center',
                flexDirection: 'row',
                justifyContent: 'center',
                gap: 8,
                shadowColor: loading ? 'transparent' : c.primary,
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: loading ? 0 : 0.45,
                shadowRadius: 12,
                elevation: loading ? 0 : 8,
                opacity: loading ? 0.8 : 1,
              }}
              onPress={handleLogin}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading && <ActivityIndicator color="#fff" size={17} />}
              <Text style={{ color: '#fff', fontSize: 15, fontWeight: '700' }}>{loading ? 'Signing in…' : 'Sign In'}</Text>
            </TouchableOpacity>

            {/* Divider */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 24 }}>
              <View style={{ flex: 1, height: 1, backgroundColor: c.border }} />
              <Text style={{ fontSize: 12, fontWeight: '500', color: c.muted }}>or</Text>
              <View style={{ flex: 1, height: 1, backgroundColor: c.border }} />
            </View>

            {/* Phone login button */}
            <TouchableOpacity
              style={{
                borderWidth: 1.5,
                borderColor: c.border,
                borderRadius: 12,
                paddingVertical: 12,
                alignItems: 'center',
                flexDirection: 'row',
                justifyContent: 'center',
                gap: 8,
              }}
              activeOpacity={0.7}
              onPress={() => {}}
            >
              <Text style={{ fontSize: 16 }}>📱</Text>
              <Text style={{ fontSize: 14, fontWeight: '600', color: c.text }}>Continue with Phone Number</Text>
            </TouchableOpacity>

            {/* Sign Up Link */}
            <View style={{ marginTop: 24, alignItems: 'center' }}>
              <Text style={{ fontSize: 14, color: c.muted }}>
                Don't have an account?{' '}
                <Text
                  style={{ color: c.primary, fontWeight: '700' }}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    router.push('/(auth)/register');
                  }}
                >
                  Create one free
                </Text>
              </Text>
            </View>

            {/* Demo Hint */}
            <View style={{
              marginTop: 24,
              backgroundColor: c.card,
              borderWidth: 1,
              borderColor: c.border,
              borderRadius: 12,
              padding: 14,
              flexDirection: 'row',
              alignItems: 'flex-start',
              gap: 8,
            }}>
              <Text style={{ fontSize: 14, lineHeight: 18 }}>💡</Text>
              <Text style={{ flex: 1, fontSize: 12, color: c.muted, lineHeight: 18 }}>
                <Text style={{ fontWeight: '600', color: c.text }}>Demo:</Text> any username + password of 4+ chars.
              </Text>
            </View>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
