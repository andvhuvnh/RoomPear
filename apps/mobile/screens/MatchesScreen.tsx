import { View, Text, StyleSheet } from 'react-native';

export default function MatchesScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Matches</Text>
      <Text style={styles.subtitle}>Your matches will appear here.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    backgroundColor: '#FDFDFD',
  },
  title: {
    fontSize: 22,
    fontWeight: '600',
    color: '#0C5389',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#2B3A4A',
    textAlign: 'center',
  },
});
