using System;
using System.Collections.Generic;
using UnityEngine;

namespace Sokoban.Progress
{
    [Serializable]
    public class LevelRecord
    {
        public int index;
        public bool completed;
        public int bestMoves;
        public int bestPushes;
    }

    [Serializable]
    class CollectionRecord
    {
        public string name;
        public int lastPlayedIndex;
        public List<LevelRecord> levels = new List<LevelRecord>();
    }

    [Serializable]
    class ProgressRoot
    {
        public bool muted;
        public List<CollectionRecord> collections = new List<CollectionRecord>();
    }

    /// <summary>Tiến độ lưu dưới dạng JSON trong PlayerPrefs; WebGL tự đẩy xuống IndexedDB.</summary>
    public static class ProgressStore
    {
        const string Key = "Sokoban.Progress";

        static ProgressRoot _cache;

        static ProgressRoot Root
        {
            get
            {
                if (_cache != null) return _cache;

                string json = PlayerPrefs.GetString(Key, "");
                if (string.IsNullOrEmpty(json))
                {
                    _cache = new ProgressRoot();
                    return _cache;
                }

                try
                {
                    _cache = JsonUtility.FromJson<ProgressRoot>(json) ?? new ProgressRoot();
                }
                catch (Exception e)
                {
                    // Dữ liệu hỏng thì bắt đầu lại, không được ném lỗi làm treo game.
                    Debug.LogWarning($"ProgressStore: tiến độ hỏng, đặt lại từ đầu ({e.Message})");
                    _cache = new ProgressRoot();
                }

                if (_cache.collections == null) _cache.collections = new List<CollectionRecord>();
                return _cache;
            }
        }

        static void Save()
        {
            PlayerPrefs.SetString(Key, JsonUtility.ToJson(Root));
            PlayerPrefs.Save();
        }

        static CollectionRecord GetCollection(string collection)
        {
            foreach (var c in Root.collections)
                if (c.name == collection) return c;

            var created = new CollectionRecord { name = collection };
            Root.collections.Add(created);
            return created;
        }

        public static LevelRecord GetRecord(string collection, int index)
        {
            var coll = GetCollection(collection);
            foreach (var l in coll.levels)
                if (l.index == index) return l;

            var created = new LevelRecord { index = index };
            coll.levels.Add(created);
            return created;
        }

        public static void RecordCompletion(string collection, int index, int moves, int pushes)
        {
            var rec = GetRecord(collection, index);

            if (!rec.completed)
            {
                rec.completed = true;
                rec.bestMoves = moves;
                rec.bestPushes = pushes;
            }
            else
            {
                if (moves < rec.bestMoves) rec.bestMoves = moves;
                if (pushes < rec.bestPushes) rec.bestPushes = pushes;
            }

            Save();
        }

        /// <summary>Mở khoá tuần tự: màn 0 luôn mở, màn n mở khi màn n-1 đã xong.</summary>
        public static bool IsUnlocked(string collection, int index)
        {
            if (index <= 0) return true;
            return GetRecord(collection, index - 1).completed;
        }

        public static int GetLastPlayedIndex(string collection) => GetCollection(collection).lastPlayedIndex;

        public static void SetLastPlayedIndex(string collection, int index)
        {
            GetCollection(collection).lastPlayedIndex = index;
            Save();
        }

        public static bool Muted
        {
            get => Root.muted;
            set { Root.muted = value; Save(); }
        }

        public static void Clear()
        {
            // Đặt null chứ không phải object rỗng: lần truy cập sau phải đọc lại PlayerPrefs.
            // Nếu gán object rỗng, cache luôn khác null nên nhánh đọc-và-bắt-lỗi không bao giờ chạy,
            // và test JSON hỏng sẽ xanh vì lý do sai.
            _cache = null;
            PlayerPrefs.DeleteKey(Key);
            PlayerPrefs.Save();
        }
    }
}
