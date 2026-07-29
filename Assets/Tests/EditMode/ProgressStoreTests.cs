using NUnit.Framework;
using Sokoban.Progress;
using UnityEngine;

namespace Sokoban.Tests
{
    public class ProgressStoreTests
    {
        const string Coll = "TestColl";

        [SetUp]
        public void Reset() => ProgressStore.Clear();

        [TearDown]
        public void Cleanup() => ProgressStore.Clear();

        [Test]
        public void FirstLevel_IsUnlockedByDefault()
        {
            Assert.IsTrue(ProgressStore.IsUnlocked(Coll, 0));
            Assert.IsFalse(ProgressStore.IsUnlocked(Coll, 1));
        }

        [Test]
        public void CompletingALevel_UnlocksTheNextOne()
        {
            ProgressStore.RecordCompletion(Coll, 0, moves: 12, pushes: 3);

            Assert.IsTrue(ProgressStore.GetRecord(Coll, 0).completed);
            Assert.IsTrue(ProgressStore.IsUnlocked(Coll, 1));
            Assert.IsFalse(ProgressStore.IsUnlocked(Coll, 2));
        }

        [Test]
        public void BestScores_OnlyImprove()
        {
            ProgressStore.RecordCompletion(Coll, 0, moves: 12, pushes: 3);
            ProgressStore.RecordCompletion(Coll, 0, moves: 20, pushes: 9);

            var rec = ProgressStore.GetRecord(Coll, 0);
            Assert.AreEqual(12, rec.bestMoves, "lượt tệ hơn không được ghi đè kỷ lục");
            Assert.AreEqual(3, rec.bestPushes);

            ProgressStore.RecordCompletion(Coll, 0, moves: 8, pushes: 2);
            rec = ProgressStore.GetRecord(Coll, 0);
            Assert.AreEqual(8, rec.bestMoves);
            Assert.AreEqual(2, rec.bestPushes);
        }

        [Test]
        public void LastPlayedIndex_RoundTrips()
        {
            ProgressStore.SetLastPlayedIndex(Coll, 7);
            Assert.AreEqual(7, ProgressStore.GetLastPlayedIndex(Coll));
        }

        [Test]
        public void MuteFlag_RoundTrips()
        {
            Assert.IsFalse(ProgressStore.Muted);
            ProgressStore.Muted = true;
            Assert.IsTrue(ProgressStore.Muted);
        }

        [Test]
        public void CorruptJson_ResetsInsteadOfThrowing()
        {
            PlayerPrefs.SetString("Sokoban.Progress", "{ this is not json");
            PlayerPrefs.Save();

            Assert.DoesNotThrow(() => ProgressStore.GetRecord(Coll, 0));
            Assert.IsTrue(ProgressStore.IsUnlocked(Coll, 0));
            Assert.IsFalse(ProgressStore.GetRecord(Coll, 0).completed);
        }
    }
}
