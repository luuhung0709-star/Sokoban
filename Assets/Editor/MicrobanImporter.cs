using System.IO;
using Sokoban.Levels;
using UnityEditor;
using UnityEngine;

namespace Sokoban.EditorTools
{
    public static class MicrobanImporter
    {
        const string DefaultTextPath = "Assets/Levels/microban.txt";
        const string DefaultAssetPath = "Assets/Levels/Microban.asset";

        [MenuItem("Sokoban/Import Microban .txt…")]
        public static void ImportDefault()
        {
            string path = EditorUtility.OpenFilePanel("Chọn file màn Sokoban", "Assets/Levels", "txt");
            if (string.IsNullOrEmpty(path)) return;
            ImportFile(path, DefaultAssetPath);
        }

        public static void ImportFile(string textFilePath, string assetPath)
        {
            if (!File.Exists(textFilePath))
            {
                Debug.LogError($"MicrobanImporter: không thấy file {textFilePath}");
                return;
            }

            var collection = AssetDatabase.LoadAssetAtPath<LevelCollection>(assetPath);
            if (collection == null)
            {
                collection = ScriptableObject.CreateInstance<LevelCollection>();
                Directory.CreateDirectory(Path.GetDirectoryName(assetPath));
                AssetDatabase.CreateAsset(collection, assetPath);
            }

            int count = ImportTextIntoCollection(File.ReadAllText(textFilePath), collection);
            collection.collectionName = "Microban";

            EditorUtility.SetDirty(collection);
            AssetDatabase.SaveAssets();
            AssetDatabase.Refresh();

            Debug.Log($"MicrobanImporter: nạp {count} màn vào {assetPath}");
        }

        /// <summary>Nạp text vào collection, trả về số màn đã nạp. Lỗi từng màn ghi ra console.</summary>
        public static int ImportTextIntoCollection(string text, LevelCollection target)
        {
            var result = MicrobanParser.Parse(text);

            foreach (var error in result.Errors)
                Debug.LogError($"MicrobanImporter: {error}");

            target.levels.Clear();
            target.levels.AddRange(result.Levels);
            return result.Levels.Count;
        }
    }
}
