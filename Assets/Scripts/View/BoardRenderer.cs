using System.Collections.Generic;
using Sokoban.Core;
using UnityEngine;
using UnityEngine.Tilemaps;

namespace Sokoban.View
{
    /// <summary>Vẽ phần tĩnh của màn ra 3 Tilemap và quản lý pool người chơi + hộp.</summary>
    public class BoardRenderer : MonoBehaviour
    {
        [Header("Tilemaps")]
        [SerializeField] Tilemap groundTilemap;
        [SerializeField] Tilemap goalTilemap;
        [SerializeField] Tilemap wallTilemap;

        [Header("Tiles")]
        [SerializeField] TileBase groundTile;
        [SerializeField] TileBase groundTileB;
        [SerializeField] TileBase goalTile;
        [SerializeField] TileBase wallTile;

        [Header("Prefabs")]
        [SerializeField] GameObject playerPrefab;
        [SerializeField] GameObject boxPrefab;
        [SerializeField] Transform boardRoot;

        [Header("Box sprites")]
        [SerializeField] Sprite boxSprite;
        [SerializeField] Sprite boxOnGoalSprite;

        [Header("Player sprites (theo hướng nhìn)")]
        [SerializeField] Sprite playerDownSprite;
        [SerializeField] Sprite playerUpSprite;
        [SerializeField] Sprite playerLeftSprite;
        [SerializeField] Sprite playerRightSprite;

        readonly List<GameObject> _boxPool = new List<GameObject>();
        readonly Dictionary<Vector2Int, GameObject> _boxByCell = new Dictionary<Vector2Int, GameObject>();
        GameObject _player;

        /// <summary>Tâm ô (x, y) trong world. y của bàn cờ tăng xuống nên world y đảo dấu.</summary>
        public static Vector3 CellToWorld(Vector2Int cell) =>
            new Vector3(cell.x + 0.5f, -cell.y - 0.5f, 0f);

        public Transform GetPlayerTransform() => _player != null ? _player.transform : null;

        public Transform GetBoxTransform(Vector2Int cell) =>
            _boxByCell.TryGetValue(cell, out var go) ? go.transform : null;

        public void Render(Board board)
        {
            groundTilemap.ClearAllTiles();
            goalTilemap.ClearAllTiles();
            wallTilemap.ClearAllTiles();

            for (int y = 0; y < board.Height; y++)
            {
                for (int x = 0; x < board.Width; x++)
                {
                    var cell = new Vector2Int(x, y);
                    var pos = new Vector3Int(x, -y - 1, 0);
                    var type = board.GetCell(cell);

                    if (type == CellType.Wall)
                    {
                        wallTilemap.SetTile(pos, Resolve(wallTile, "wall"));
                        continue;
                    }

                    // Sàn hai tông xen kẽ như bàn cờ, để bàn chơi rộng đỡ phẳng lì.
                    bool even = (x + y) % 2 == 0;
                    groundTilemap.SetTile(pos, even
                        ? Resolve(groundTile, "ground")
                        : Resolve(groundTileB, "ground B"));
                    if (type == CellType.Goal) goalTilemap.SetTile(pos, Resolve(goalTile, "goal"));
                }
            }

            SpawnActors(board);
        }

        void SpawnActors(Board board)
        {
            if (_player == null)
                _player = Instantiate(playerPrefab, boardRoot);
            _player.transform.position = CellToWorld(board.PlayerPos);
            SetPlayerFacing(Direction.Down);   // vào màn mới thì nhìn thẳng ra người chơi

            foreach (var go in _boxPool) go.SetActive(false);
            _boxByCell.Clear();

            int i = 0;
            foreach (var boxCell in board.Boxes)
            {
                if (i >= _boxPool.Count) _boxPool.Add(Instantiate(boxPrefab, boardRoot));

                var go = _boxPool[i];
                go.SetActive(true);
                go.transform.position = CellToWorld(boxCell);
                _boxByCell[boxCell] = go;

                SetBoxSprite(boxCell, board.GetCell(boxCell) == CellType.Goal);
                i++;
            }
        }

        /// <summary>Cập nhật sổ tay vị trí hộp sau khi một hộp bị đẩy.</summary>
        public void MoveBoxRecord(Vector2Int from, Vector2Int to)
        {
            if (!_boxByCell.TryGetValue(from, out var go)) return;
            _boxByCell.Remove(from);
            _boxByCell[to] = go;
        }

        /// <summary>Quay mặt người chơi. Thiếu sprite hướng nào thì giữ nguyên ảnh đang có.</summary>
        public void SetPlayerFacing(Direction dir)
        {
            if (_player == null) return;

            var sprite = dir switch
            {
                Direction.Up => playerUpSprite,
                Direction.Down => playerDownSprite,
                Direction.Left => playerLeftSprite,
                _ => playerRightSprite
            };
            if (sprite == null) return;

            var sr = _player.GetComponent<SpriteRenderer>();
            if (sr != null) sr.sprite = sprite;
        }

        public void SetBoxSprite(Vector2Int cell, bool onGoal)
        {
            if (!_boxByCell.TryGetValue(cell, out var go)) return;
            var sr = go.GetComponent<SpriteRenderer>();
            if (sr != null) sr.sprite = onGoal ? boxOnGoalSprite : boxSprite;
        }

        readonly HashSet<string> _warned = new HashSet<string>();
        TileBase _placeholder;

        /// <summary>Thiếu Tile asset thì vẽ ô hồng chói, không im lặng bỏ trống ô đó.</summary>
        TileBase Resolve(TileBase tile, string role)
        {
            if (tile != null) return tile;

            if (_warned.Add(role))
                Debug.LogError($"BoardRenderer: chưa gán Tile asset '{role}', đang vẽ ô hồng thay thế.", this);

            if (_placeholder == null)
            {
                var texture = new Texture2D(1, 1);
                texture.SetPixel(0, 0, Color.magenta);
                texture.Apply();

                var placeholderTile = ScriptableObject.CreateInstance<Tile>();
                placeholderTile.sprite = Sprite.Create(
                    texture, new Rect(0, 0, 1, 1), new Vector2(0.5f, 0.5f), pixelsPerUnit: 1f);
                _placeholder = placeholderTile;
            }

            return _placeholder;
        }
    }
}
