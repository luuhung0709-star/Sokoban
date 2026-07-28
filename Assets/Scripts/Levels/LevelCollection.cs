using System.Collections.Generic;
using UnityEngine;

namespace Sokoban.Levels
{
    [CreateAssetMenu(fileName = "LevelCollection", menuName = "Sokoban/Level Collection")]
    public class LevelCollection : ScriptableObject
    {
        public string collectionName;
        public List<LevelData> levels = new List<LevelData>();
    }
}
