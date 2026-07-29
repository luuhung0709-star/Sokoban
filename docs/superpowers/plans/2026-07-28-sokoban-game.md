# Sokoban Game Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Một game Sokoban hoàn chỉnh chạy trên trình duyệt — 155 màn Microban, undo/redo không giới hạn, chọn màn có lưu tiến độ, animation mượt, âm thanh, kèm level editor cho dev.

**Architecture:** Ba Tilemap vẽ phần tĩnh của màn (nền / ô đích / tường); người chơi và hộp là GameObject riêng để tween được. Luật chơi chạy trên một lưới trong bộ nhớ (`Board`) tách hẳn khỏi trạng thái hiển thị, nên undo/redo và animation không đụng vào Tilemap. Màn chơi lưu trong một ScriptableObject `LevelCollection` duy nhất, sinh ra từ file text Microban qua importer trong Editor.

**Tech Stack:** Unity 2021.3.43f1, template 2D (Built-in RP), C# 9, `com.unity.modules.tilemap`, Unity Test Framework (EditMode), TextMeshPro, build target WebGL.

**Spec:** [`docs/superpowers/specs/2026-07-28-sokoban-game-design.md`](../specs/2026-07-28-sokoban-game-design.md)

## Global Constraints

Mọi task đều ngầm chịu các ràng buộc sau.

- **Unity 2021.3.43f1**, project tại `D:\Hung\Sokoban`. Không nâng version, không đổi render pipeline.
- **Chỉ mở một Unity Editor tại một thời điểm.** MCP server dùng chung endpoint `http://127.0.0.1:8080/mcp` cho mọi project và URL nằm ở EditorPrefs toàn máy, nên khi làm Sokoban phải đóng Editor của Sputnika. Trước khi dùng tool MCP, đọc `mcpforunity://instances` và xác nhận chỉ có `Sokoban@...`.
- **Input dùng `UnityEngine.Input` (Input Manager cũ).** Không thêm package Input System.
- **Hệ toạ độ bàn cờ**: `x` tăng sang phải, **`y` tăng xuống dưới** (y chính là chỉ số hàng trong file text). `Direction.Up` = `(0, -1)`, `Down` = `(0, +1)`, `Left` = `(-1, 0)`, `Right` = `(+1, 0)`. Sai chỗ này là nguồn bug phổ biến nhất của plan này — bám đúng quy ước, đừng tự đảo dấu giữa chừng.
- **Quy đổi bàn cờ → world.** Toạ độ ô của Tilemap là **góc dưới-trái**, không phải tâm: ô tile `(cx, cy)` chiếm world `[cx, cx+1] × [cy, cy+1]`, tâm ở `(cx+0.5, cy+0.5)`. Vì vậy ô bàn cờ `(x, y)` đặt tile tại **`new Vector3Int(x, -y - 1, 0)`**, và tâm của nó — nơi đặt sprite người chơi/hộp — là `new Vector3(x + 0.5f, -y - 0.5f, 0)`. Hai công thức này phải khớp nhau; lệch `-1` là cả bàn cờ trôi đúng một ô so với người chơi và hộp.
  Hệ quả: bàn cờ trải world `x ∈ [0, width]`, `y ∈ [-height, 0]`, nên tâm bàn cờ là `(width/2, -height/2)` — đúng cái `CameraFitter` dùng.
  *(Bản plan đầu ghi tile tại `(x, -y)` mà tâm lại là `-y-0.5`, lệch nhau một ô; phát hiện ở Task 6 khi soi ảnh chụp thật.)*
- **Ngoài lưới coi như tường.** `Board.GetCell` trả `CellType.Wall` cho toạ độ ngoài biên, nên không cần kiểm tra biên rải rác khắp nơi.
- **Ký tự Sokoban**: `#` tường, ` ` nền, `@` người, `+` người trên đích, `$` hộp, `*` hộp trên đích, `.` đích.
- **Assembly definition**: code chia làm ba assembly `Sokoban.Runtime`, `Sokoban.Editor`, `Sokoban.Tests.EditMode`. Lưu ý: khi đã có asmdef thì `Type.GetType("SomeType")` **không** tìm thấy type nếu không kèm tên assembly — dùng tham chiếu trực tiếp thay vì tra cứu bằng chuỗi.
- **Chạy test**: MCP tool `run_tests` với `mode: "EditMode"`, hoặc Window → General → Test Runner → EditMode → Run All. Sau mỗi lần compile, gọi `read_console` để chắc chắn 0 lỗi trước khi đi tiếp.
- **Commit thường xuyên**, mỗi task ít nhất một commit. Không dùng `git add -A` — luôn stage đúng đường dẫn đã đổi.
- **Không tự bịa asset.** Hai nguồn ngoài đã xác minh tải được; nếu link chết thì dừng và hỏi người dùng.

---

## File Structure

**Assets/Scripts/** (assembly `Sokoban.Runtime`)

| File | Trách nhiệm |
|---|---|
| `Sokoban.Runtime.asmdef` | Khai báo assembly runtime |
| `Levels/SokobanChars.cs` | Hằng số 7 ký tự + hàm phân loại ký tự |
| `Levels/LevelData.cs` | `[Serializable]` một màn: tên, kích thước, các hàng |
| `Levels/LevelCollection.cs` | ScriptableObject chứa danh sách `LevelData` |
| `Levels/MicrobanParser.cs` | Text Microban → `ParseResult` (màn + lỗi kèm số dòng) |
| `Levels/LevelValidator.cs` | Kiểm tra hợp lệ: 1 người, hộp = đích, kín tường |
| `Core/CellType.cs` | Enum `Wall / Floor / Goal` |
| `Core/Direction.cs` | Enum 4 hướng + delta + hướng ngược |
| `Core/Board.cs` | Lưới tĩnh + vị trí người + tập hộp + `IsSolved` |
| `Core/MoveResult.cs` | Kết quả một nước đi (chặn / đi / đẩy) + toạ độ |
| `Core/MoveResolver.cs` | Hàm thuần `(Board, Direction) → MoveResult` |
| `Core/MoveHistory.cs` | Stack undo + stack redo |
| `Core/GameSession.cs` | Gói Board + History + bộ đếm + sự kiện |
| `View/BoardRenderer.cs` | Vẽ 3 Tilemap, spawn/pool người chơi và hộp |
| `View/MoveAnimator.cs` | Tween vị trí, hàng đợi input 1 nước |
| `View/CameraFitter.cs` | Canh orthographic size theo kích thước màn |
| `Input/InputRouter.cs` | Bàn phím + vuốt → `Direction` và lệnh |
| `Progress/ProgressStore.cs` | Đọc/ghi tiến độ JSON vào PlayerPrefs |
| `Audio/AudioService.cs` | SFX + nhạc nền + tắt tiếng |
| `UI/GameFlowController.cs` | Điều phối các panel |
| `UI/MainMenuPanel.cs` | Panel menu chính |
| `UI/LevelSelectPanel.cs` | Lưới nút chọn màn |
| `UI/LevelButtonView.cs` | Một nút màn: số, dấu tick, kỷ lục, trạng thái khoá |
| `UI/HudPanel.cs` | Bộ đếm + hàng nút trong màn |
| `UI/LevelCompletePanel.cs` | Panel thắng màn |

**Assets/Editor/** (assembly `Sokoban.Editor`)

| File | Trách nhiệm |
|---|---|
| `Sokoban.Editor.asmdef` | Assembly editor, tham chiếu `Sokoban.Runtime` |
| `MicrobanImporter.cs` | Menu item: file `.txt` → `LevelCollection` asset |
| `LevelCollectionWindow.cs` | EditorWindow vẽ/sửa màn bằng cọ |

**Assets/Tests/EditMode/** (assembly `Sokoban.Tests.EditMode`)

| File | Trách nhiệm |
|---|---|
| `Sokoban.Tests.EditMode.asmdef` | Assembly test |
| `MicrobanParserTests.cs` | Parser: 7 ký tự, pad, lỗi có số dòng |
| `MicrobanRegressionTests.cs` | Toàn bộ 155 màn hợp lệ và kín tường |
| `BoardTests.cs` | Dựng board, `IsSolved` |
| `MoveResolverTests.cs` | Đi, chặn, đẩy, đẩy hai hộp |
| `MoveHistoryTests.cs` | Undo, redo, xoá nhánh redo |
| `SolutionPlaythroughTests.cs` | Chạy lời giải vài màn đầu tới thắng |
| `LevelValidatorTests.cs` | Các lỗi validator bắt được |
| `ProgressStoreTests.cs` | Lưu, đọc, JSON hỏng |

**Assets/Levels/** — `Microban.asset`, và `microban.txt` (nguồn, để import lại).
**Assets/Art/Kenney/** — sprite đã giải nén. **Assets/Tiles/** — 3 `Tile` asset.
**Assets/Scenes/Main.unity** — scene duy nhất.

---

## Task 1: Cấu trúc assembly + parser Microban

**Files:**
- Create: `Assets/Scripts/Sokoban.Runtime.asmdef`
- Create: `Assets/Scripts/Levels/SokobanChars.cs`
- Create: `Assets/Scripts/Levels/LevelData.cs`
- Create: `Assets/Scripts/Levels/LevelCollection.cs`
- Create: `Assets/Scripts/Levels/MicrobanParser.cs`
- Create: `Assets/Tests/EditMode/Sokoban.Tests.EditMode.asmdef`
- Test: `Assets/Tests/EditMode/MicrobanParserTests.cs`

**Interfaces:**
- Consumes: —
- Produces:
  - `Sokoban.Levels.SokobanChars` — hằng `Wall '#'`, `Floor ' '`, `Player '@'`, `PlayerOnGoal '+'`, `Box '$'`, `BoxOnGoal '*'`, `Goal '.'`; `static bool IsGrid(char)`, `static bool IsContent(char)`
  - `Sokoban.Levels.LevelData` — trường public `string name; int width; int height; string[] rows;`
  - `Sokoban.Levels.LevelCollection : ScriptableObject` — `string collectionName; List<LevelData> levels;`
  - `Sokoban.Levels.ParseResult` — `List<LevelData> Levels; List<string> Errors;`
  - `Sokoban.Levels.MicrobanParser.Parse(string text) → ParseResult`

- [ ] **Step 1: Tạo hai assembly definition**

`Assets/Scripts/Sokoban.Runtime.asmdef`:

```json
{
    "name": "Sokoban.Runtime",
    "rootNamespace": "Sokoban",
    "references": [],
    "includePlatforms": [],
    "excludePlatforms": [],
    "allowUnsafeCode": false,
    "overrideReferences": false,
    "precompiledReferences": [],
    "autoReferenced": true,
    "defineConstraints": [],
    "versionDefines": [],
    "noEngineReferences": false
}
```

`Assets/Tests/EditMode/Sokoban.Tests.EditMode.asmdef`:

```json
{
    "name": "Sokoban.Tests.EditMode",
    "rootNamespace": "Sokoban.Tests",
    "references": [
        "Sokoban.Runtime",
        "UnityEngine.TestRunner",
        "UnityEditor.TestRunner"
    ],
    "includePlatforms": [ "Editor" ],
    "excludePlatforms": [],
    "allowUnsafeCode": false,
    "overrideReferences": true,
    "precompiledReferences": [ "nunit.framework.dll" ],
    "autoReferenced": false,
    "defineConstraints": [ "UNITY_INCLUDE_TESTS" ],
    "versionDefines": [],
    "noEngineReferences": false
}
```

- [ ] **Step 2: Viết test thất bại cho parser**

`Assets/Tests/EditMode/MicrobanParserTests.cs`:

```csharp
using NUnit.Framework;
using Sokoban.Levels;

namespace Sokoban.Tests
{
    public class MicrobanParserTests
    {
        // Khối header của file Microban thật: không phải màn chơi, phải bị bỏ qua lặng lẽ.
        const string HeaderBlock =
            "Title: Microban\n" +
            "Description: Microban (155 puzzles)\n" +
            "             continuation line\n" +
            "Author: David W Skinner\n";

        const string OneLevel =
            "####\n" +
            "# .#\n" +
            "#  ###\n" +
            "#*@  #\n" +
            "#  $ #\n" +
            "#  ###\n" +
            "####\n" +
            "Title: 1\n";

        [Test]
        public void Parse_SkipsHeaderBlock_AndReadsLevel()
        {
            var result = MicrobanParser.Parse(HeaderBlock + "\n" + OneLevel);

            Assert.AreEqual(0, result.Errors.Count, string.Join("; ", result.Errors));
            Assert.AreEqual(1, result.Levels.Count);
        }

        [Test]
        public void Parse_TakesNameFromTitleLineAfterGrid()
        {
            var result = MicrobanParser.Parse(OneLevel);
            Assert.AreEqual("1", result.Levels[0].name);
        }

        [Test]
        public void Parse_PadsShortRowsToFullWidth()
        {
            var level = MicrobanParser.Parse(OneLevel).Levels[0];

            Assert.AreEqual(6, level.width);
            Assert.AreEqual(7, level.height);
            foreach (var row in level.rows)
                Assert.AreEqual(6, row.Length, $"row not padded: '{row}'");
            Assert.AreEqual("####  ", level.rows[0]);
        }

        [Test]
        public void Parse_AcceptsPlayerOnGoalAndBoxOnGoal()
        {
            // '+' vừa là người vừa là đích, '*' vừa là hộp vừa là đích.
            // Đếm ra: hộp = '*' + '$' + '$' = 3; đích = '+' + '*' + '.' = 3 => cân.
            const string text =
                "######\n" +
                "#+* $#\n" +
                "# $. #\n" +
                "######\n" +
                "Title: chars\n";

            var result = MicrobanParser.Parse(text);

            Assert.AreEqual(0, result.Errors.Count, string.Join("; ", result.Errors));
            Assert.AreEqual(1, result.Levels.Count);
            Assert.AreEqual("#+* $#", result.Levels[0].rows[1]);
        }

        [Test]
        public void Parse_ReportsLineNumber_WhenBoxCountDiffersFromGoals()
        {
            const string text =
                "#####\n" +
                "#@$ #\n" +   // 1 hộp, 0 đích
                "#####\n" +
                "Title: bad\n";

            var result = MicrobanParser.Parse(text);

            Assert.AreEqual(0, result.Levels.Count);
            Assert.AreEqual(1, result.Errors.Count);
            StringAssert.Contains("Line 1", result.Errors[0]);
        }

        [Test]
        public void Parse_KeepsGoodLevels_WhenOneBlockIsBroken()
        {
            const string broken =
                "#####\n" +
                "#@$ #\n" +
                "#####\n" +
                "Title: bad\n";

            var result = MicrobanParser.Parse(broken + "\n" + OneLevel);

            Assert.AreEqual(1, result.Errors.Count);
            Assert.AreEqual(1, result.Levels.Count, "một màn hỏng không được làm mất màn còn lại");
            Assert.AreEqual("1", result.Levels[0].name);
        }

        [Test]
        public void Parse_ReportsTwoPlayers()
        {
            const string text =
                "######\n" +
                "#@$.@#\n" +
                "######\n";

            var result = MicrobanParser.Parse(text);

            Assert.AreEqual(0, result.Levels.Count);
            StringAssert.Contains("player", result.Errors[0]);
        }
    }
}
```

- [ ] **Step 3: Chạy test, xác nhận thất bại**

Chạy MCP `run_tests` với `mode: "EditMode"`.
Kỳ vọng: FAIL — compile error, chưa có type `MicrobanParser`.

- [ ] **Step 4: Viết `SokobanChars.cs`**

```csharp
namespace Sokoban.Levels
{
    /// <summary>Bảy ký tự của định dạng Sokoban chuẩn.</summary>
    public static class SokobanChars
    {
        public const char Wall = '#';
        public const char Floor = ' ';
        public const char Player = '@';
        public const char PlayerOnGoal = '+';
        public const char Box = '$';
        public const char BoxOnGoal = '*';
        public const char Goal = '.';

        public static bool IsGrid(char c) =>
            c == Wall || c == Floor || c == Player || c == PlayerOnGoal ||
            c == Box || c == BoxOnGoal || c == Goal;

        /// <summary>Ký tự lưới khác nền trống — dùng để phân biệt hàng lưới với dòng chữ.</summary>
        public static bool IsContent(char c) => IsGrid(c) && c != Floor;
    }
}
```

- [ ] **Step 5: Viết `LevelData.cs` và `LevelCollection.cs`**

```csharp
using System;

namespace Sokoban.Levels
{
    [Serializable]
    public class LevelData
    {
        public string name;
        public int width;
        public int height;
        /// <summary>Mỗi phần tử là một hàng, đã pad bằng dấu cách cho đủ <see cref="width"/>.</summary>
        public string[] rows;
    }
}
```

```csharp
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
```

- [ ] **Step 6: Viết `MicrobanParser.cs`**

Định dạng thật (đã kiểm chứng trên file tải về): các khối cách nhau bằng dòng trống; khối đầu là
header (`Title:`/`Description:`/`Author:`/`Email:`/`Website:`) và **không** phải màn chơi; mỗi khối màn
gồm các hàng lưới rồi tới dòng `Title: <n>` **ở cuối khối**. File không có dòng chú thích `;` nào.

```csharp
using System.Collections.Generic;

namespace Sokoban.Levels
{
    public class ParseResult
    {
        public readonly List<LevelData> Levels = new List<LevelData>();
        public readonly List<string> Errors = new List<string>();
    }

    public static class MicrobanParser
    {
        const string TitlePrefix = "Title:";

        public static ParseResult Parse(string text)
        {
            var result = new ParseResult();
            if (string.IsNullOrEmpty(text)) return result;

            var lines = text.Replace("\r\n", "\n").Replace('\r', '\n').Split('\n');

            int i = 0;
            while (i < lines.Length)
            {
                while (i < lines.Length && lines[i].Trim().Length == 0) i++;
                if (i >= lines.Length) break;

                int blockStartLine = i + 1;          // số dòng 1-based cho thông báo lỗi
                var block = new List<string>();
                while (i < lines.Length && lines[i].Trim().Length != 0)
                {
                    block.Add(lines[i]);
                    i++;
                }

                TryAddLevel(block, blockStartLine, result);
            }

            return result;
        }

        static void TryAddLevel(List<string> block, int blockStartLine, ParseResult result)
        {
            var rows = new List<string>();
            string name = null;

            foreach (var line in block)
            {
                if (line.StartsWith(TitlePrefix))
                {
                    name = line.Substring(TitlePrefix.Length).Trim();
                    continue;
                }
                if (IsGridLine(line)) rows.Add(line);
            }

            // Khối header không có hàng lưới nào — bỏ qua, đây không phải lỗi.
            if (rows.Count == 0) return;

            int players = 0, boxes = 0, goals = 0;
            foreach (var row in rows)
            {
                foreach (var c in row)
                {
                    if (c == SokobanChars.Player || c == SokobanChars.PlayerOnGoal) players++;
                    if (c == SokobanChars.Box || c == SokobanChars.BoxOnGoal) boxes++;
                    if (c == SokobanChars.Goal || c == SokobanChars.BoxOnGoal ||
                        c == SokobanChars.PlayerOnGoal) goals++;
                }
            }

            if (players != 1)
            {
                result.Errors.Add($"Line {blockStartLine}: expected exactly 1 player, found {players}");
                return;
            }
            if (boxes == 0)
            {
                result.Errors.Add($"Line {blockStartLine}: level has no boxes");
                return;
            }
            if (boxes != goals)
            {
                result.Errors.Add($"Line {blockStartLine}: {boxes} boxes but {goals} goals");
                return;
            }

            int width = 0;
            foreach (var row in rows)
                if (row.Length > width) width = row.Length;

            var padded = new string[rows.Count];
            for (int r = 0; r < rows.Count; r++) padded[r] = rows[r].PadRight(width);

            result.Levels.Add(new LevelData
            {
                name = string.IsNullOrEmpty(name) ? $"Level {result.Levels.Count + 1}" : name,
                width = width,
                height = rows.Count,
                rows = padded
            });
        }

        /// <summary>Hàng lưới = chỉ gồm 7 ký tự hợp lệ và có ít nhất một ký tự khác dấu cách.</summary>
        static bool IsGridLine(string line)
        {
            bool hasContent = false;
            foreach (var c in line)
            {
                if (!SokobanChars.IsGrid(c)) return false;
                if (SokobanChars.IsContent(c)) hasContent = true;
            }
            return hasContent;
        }
    }
}
```

- [ ] **Step 7: Chạy test, xác nhận tất cả PASS**

Chạy MCP `run_tests` với `mode: "EditMode"`. Kỳ vọng: 7/7 test của `MicrobanParserTests` PASS.
Gọi `read_console` xác nhận không có lỗi biên dịch.

- [ ] **Step 8: Commit**

```bash
cd /d/Hung/Sokoban
git add Assets/Scripts Assets/Tests
git commit -m "Add Microban parser with assembly layout and tests"
```

---

## Task 2: Import 155 màn Microban thành asset

**Files:**
- Create: `Assets/Editor/Sokoban.Editor.asmdef`
- Create: `Assets/Editor/MicrobanImporter.cs`
- Create: `Assets/Levels/microban.txt` (tải về)
- Create: `Assets/Levels/Microban.asset` (sinh ra)
- Test: `Assets/Tests/EditMode/MicrobanRegressionTests.cs`

**Interfaces:**
- Consumes: `MicrobanParser.Parse`, `LevelCollection`, `LevelData`
- Produces:
  - `Sokoban.EditorTools.MicrobanImporter.ImportTextIntoCollection(string text, LevelCollection target) → int` (số màn đã nạp; ghi lỗi ra `Debug.LogError`)
  - Menu item `Sokoban/Import Microban .txt…`
  - Asset `Assets/Levels/Microban.asset` với đúng 155 phần tử

- [ ] **Step 1: Tải file màn về project**

```bash
cd /d/Hung/Sokoban
mkdir -p Assets/Levels
curl -L -o Assets/Levels/microban.txt \
  "http://www.sourcecode.se/sokoban/level_func.php?act=dnl_level&file=microban.slc&as_text=1"
wc -c Assets/Levels/microban.txt
```

Kỳ vọng: khoảng 16 807 byte. Nếu tải hỏng hoặc trả HTML lỗi, **dừng lại và hỏi người dùng** — không tự viết màn thay thế.

- [ ] **Step 2: Tạo assembly definition cho Editor**

`Assets/Editor/Sokoban.Editor.asmdef`:

```json
{
    "name": "Sokoban.Editor",
    "rootNamespace": "Sokoban.EditorTools",
    "references": [ "Sokoban.Runtime" ],
    "includePlatforms": [ "Editor" ],
    "excludePlatforms": [],
    "allowUnsafeCode": false,
    "overrideReferences": false,
    "precompiledReferences": [],
    "autoReferenced": true,
    "defineConstraints": [],
    "versionDefines": [],
    "noEngineReferences": false
}
```

- [ ] **Step 3: Viết test hồi quy thất bại**

`Assets/Tests/EditMode/MicrobanRegressionTests.cs`:

```csharp
using System.Collections.Generic;
using NUnit.Framework;
using Sokoban.Levels;
using UnityEditor;
using UnityEngine;

namespace Sokoban.Tests
{
    public class MicrobanRegressionTests
    {
        const string CollectionPath = "Assets/Levels/Microban.asset";

        static LevelCollection LoadCollection()
        {
            var c = AssetDatabase.LoadAssetAtPath<LevelCollection>(CollectionPath);
            Assert.IsNotNull(c, $"chưa có asset {CollectionPath} — chạy menu Sokoban/Import Microban .txt…");
            return c;
        }

        [Test]
        public void Collection_HasAll155Levels()
        {
            Assert.AreEqual(155, LoadCollection().levels.Count);
        }

        [Test]
        public void EveryLevel_HasOnePlayerAndMatchingBoxesAndGoals()
        {
            foreach (var level in LoadCollection().levels)
            {
                int players = 0, boxes = 0, goals = 0;
                foreach (var row in level.rows)
                {
                    foreach (var c in row)
                    {
                        if (c == SokobanChars.Player || c == SokobanChars.PlayerOnGoal) players++;
                        if (c == SokobanChars.Box || c == SokobanChars.BoxOnGoal) boxes++;
                        if (c == SokobanChars.Goal || c == SokobanChars.BoxOnGoal ||
                            c == SokobanChars.PlayerOnGoal) goals++;
                    }
                }

                Assert.AreEqual(1, players, $"màn '{level.name}' phải có đúng 1 người chơi");
                Assert.AreEqual(goals, boxes, $"màn '{level.name}' lệch số hộp và đích");
                Assert.Greater(boxes, 0, $"màn '{level.name}' không có hộp nào");
            }
        }

        [Test]
        public void EveryLevel_HasRowsPaddedToWidth()
        {
            foreach (var level in LoadCollection().levels)
            {
                Assert.AreEqual(level.height, level.rows.Length, $"màn '{level.name}' lệch height");
                foreach (var row in level.rows)
                    Assert.AreEqual(level.width, row.Length, $"màn '{level.name}' có hàng chưa pad");
            }
        }

        [Test]
        public void EveryLevel_IsEnclosedByWalls()
        {
            // Loang từ người chơi qua mọi ô không phải tường; không được thoát ra ngoài lưới.
            //
            // Phép loang này CỐ Ý viết lại độc lập, không gọi LevelValidator (Task 13):
            // đây là test dữ liệu, nó phải kiểm tra 155 màn thật chứ không đo lại chính
            // đoạn code mà một test khác đã kiểm. Đừng gộp hai chỗ này làm một.
            foreach (var level in LoadCollection().levels)
            {
                Vector2Int start = default;
                bool found = false;
                for (int y = 0; y < level.height && !found; y++)
                    for (int x = 0; x < level.width && !found; x++)
                    {
                        char c = level.rows[y][x];
                        if (c == SokobanChars.Player || c == SokobanChars.PlayerOnGoal)
                        {
                            start = new Vector2Int(x, y);
                            found = true;
                        }
                    }
                Assert.IsTrue(found, $"màn '{level.name}' không tìm thấy người chơi");

                var seen = new HashSet<Vector2Int> { start };
                var queue = new Queue<Vector2Int>();
                queue.Enqueue(start);
                var deltas = new[]
                {
                    new Vector2Int(1, 0), new Vector2Int(-1, 0),
                    new Vector2Int(0, 1), new Vector2Int(0, -1)
                };

                while (queue.Count > 0)
                {
                    var p = queue.Dequeue();
                    foreach (var d in deltas)
                    {
                        var n = p + d;
                        bool outside = n.x < 0 || n.x >= level.width || n.y < 0 || n.y >= level.height;
                        Assert.IsFalse(outside, $"màn '{level.name}' hở — người chơi đi ra ngoài lưới được");
                        if (level.rows[n.y][n.x] == SokobanChars.Wall || seen.Contains(n)) continue;
                        seen.Add(n);
                        queue.Enqueue(n);
                    }
                }
            }
        }
    }
}
```

- [ ] **Step 4: Chạy test, xác nhận thất bại**

Chạy `run_tests` mode EditMode.
Kỳ vọng: FAIL — `chưa có asset Assets/Levels/Microban.asset`.

- [ ] **Step 5: Viết `MicrobanImporter.cs`**

```csharp
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
```

- [ ] **Step 6: Chạy import**

Trong Unity: menu **Sokoban → Import Microban .txt…**, chọn `Assets/Levels/microban.txt`.
Kỳ vọng console: `MicrobanImporter: nạp 155 màn vào Assets/Levels/Microban.asset`, **không có** dòng LogError.

- [ ] **Step 7: Chạy test, xác nhận tất cả PASS**

Chạy `run_tests` mode EditMode. Kỳ vọng 4/4 test hồi quy PASS — 155 màn, đủ bất biến, đã pad, kín tường.

- [ ] **Step 8: Commit**

```bash
cd /d/Hung/Sokoban
git add Assets/Editor Assets/Levels Assets/Tests/EditMode/MicrobanRegressionTests.cs
git commit -m "Import the 155 Microban levels into a LevelCollection asset"
```

---

## Task 3: Board và luật đi/đẩy

**Files:**
- Create: `Assets/Scripts/Core/CellType.cs`
- Create: `Assets/Scripts/Core/Direction.cs`
- Create: `Assets/Scripts/Core/Board.cs`
- Create: `Assets/Scripts/Core/MoveResult.cs`
- Create: `Assets/Scripts/Core/MoveResolver.cs`
- Test: `Assets/Tests/EditMode/BoardTests.cs`
- Test: `Assets/Tests/EditMode/MoveResolverTests.cs`

**Interfaces:**
- Consumes: `LevelData`, `SokobanChars`
- Produces:
  - `Sokoban.Core.CellType` — `Wall, Floor, Goal`
  - `Sokoban.Core.Direction` — `Up, Down, Left, Right`; `DirectionExtensions.ToDelta(this Direction) → Vector2Int`; `.Opposite(this Direction) → Direction`
  - `Sokoban.Core.Board` — `int Width; int Height; Vector2Int PlayerPos; HashSet<Vector2Int> Boxes; CellType GetCell(Vector2Int); bool IsSolved; static Board FromLevel(LevelData)`
  - `Sokoban.Core.MoveKind` — `Blocked, Walk, Push`
  - `Sokoban.Core.MoveResult` — `MoveKind Kind; Direction Dir; Vector2Int PlayerFrom, PlayerTo, BoxFrom, BoxTo; bool IsPush`
  - `Sokoban.Core.MoveResolver.Resolve(Board, Direction) → MoveResult` (thuần, không đổi board)
  - `Sokoban.Core.MoveResolver.Apply(Board, MoveResult)` và `.Revert(Board, MoveResult)`

- [ ] **Step 1: Viết test thất bại cho Board**

`Assets/Tests/EditMode/BoardTests.cs`:

```csharp
using NUnit.Framework;
using Sokoban.Core;
using Sokoban.Levels;
using UnityEngine;

namespace Sokoban.Tests
{
    public class BoardTests
    {
        internal static LevelData Level(params string[] rows)
        {
            int width = 0;
            foreach (var r in rows) if (r.Length > width) width = r.Length;
            var padded = new string[rows.Length];
            for (int i = 0; i < rows.Length; i++) padded[i] = rows[i].PadRight(width);
            return new LevelData { name = "test", width = width, height = rows.Length, rows = padded };
        }

        [Test]
        public void FromLevel_ReadsPlayerBoxesAndStatics()
        {
            var board = Board.FromLevel(Level(
                "#####",
                "#@$.#",
                "#####"));

            Assert.AreEqual(new Vector2Int(1, 1), board.PlayerPos);
            Assert.AreEqual(1, board.Boxes.Count);
            Assert.IsTrue(board.Boxes.Contains(new Vector2Int(2, 1)));
            Assert.AreEqual(CellType.Wall, board.GetCell(new Vector2Int(0, 0)));
            Assert.AreEqual(CellType.Floor, board.GetCell(new Vector2Int(1, 1)));
            Assert.AreEqual(CellType.Goal, board.GetCell(new Vector2Int(3, 1)));
        }

        [Test]
        public void FromLevel_TreatsPlayerOnGoalAndBoxOnGoalAsGoalCells()
        {
            var board = Board.FromLevel(Level(
                "#####",
                "#+* #",
                "#####"));

            Assert.AreEqual(CellType.Goal, board.GetCell(new Vector2Int(1, 1)));
            Assert.AreEqual(CellType.Goal, board.GetCell(new Vector2Int(2, 1)));
            Assert.AreEqual(new Vector2Int(1, 1), board.PlayerPos);
            Assert.IsTrue(board.Boxes.Contains(new Vector2Int(2, 1)));
        }

        [Test]
        public void GetCell_OutsideGrid_IsWall()
        {
            var board = Board.FromLevel(Level(
                "###",
                "#@#",
                "###"));

            Assert.AreEqual(CellType.Wall, board.GetCell(new Vector2Int(-1, 0)));
            Assert.AreEqual(CellType.Wall, board.GetCell(new Vector2Int(0, 99)));
        }

        [Test]
        public void IsSolved_TrueOnlyWhenEveryBoxSitsOnAGoal()
        {
            var unsolved = Board.FromLevel(Level(
                "#####",
                "#@$.#",
                "#####"));
            Assert.IsFalse(unsolved.IsSolved);

            var solved = Board.FromLevel(Level(
                "#####",
                "#@ *#",
                "#####"));
            Assert.IsTrue(solved.IsSolved);
        }
    }
}
```

- [ ] **Step 2: Viết test thất bại cho luật đi/đẩy**

`Assets/Tests/EditMode/MoveResolverTests.cs`:

```csharp
using NUnit.Framework;
using Sokoban.Core;
using UnityEngine;

namespace Sokoban.Tests
{
    public class MoveResolverTests
    {
        [Test]
        public void Walk_IntoEmptyFloor()
        {
            var board = Board.FromLevel(BoardTests.Level(
                "#####",
                "#@  #",
                "#####"));

            var move = MoveResolver.Resolve(board, Direction.Right);

            Assert.AreEqual(MoveKind.Walk, move.Kind);
            Assert.AreEqual(new Vector2Int(2, 1), move.PlayerTo);
        }

        [Test]
        public void Blocked_ByWall()
        {
            var board = Board.FromLevel(BoardTests.Level(
                "###",
                "#@#",
                "###"));

            Assert.AreEqual(MoveKind.Blocked, MoveResolver.Resolve(board, Direction.Right).Kind);
            Assert.AreEqual(MoveKind.Blocked, MoveResolver.Resolve(board, Direction.Up).Kind);
        }

        [Test]
        public void Push_MovesBoxOneCell()
        {
            var board = Board.FromLevel(BoardTests.Level(
                "######",
                "#@$ .#",
                "######"));

            var move = MoveResolver.Resolve(board, Direction.Right);

            Assert.AreEqual(MoveKind.Push, move.Kind);
            Assert.AreEqual(new Vector2Int(2, 1), move.PlayerTo);
            Assert.AreEqual(new Vector2Int(2, 1), move.BoxFrom);
            Assert.AreEqual(new Vector2Int(3, 1), move.BoxTo);
        }

        [Test]
        public void Push_BlockedWhenBoxFacesWall()
        {
            var board = Board.FromLevel(BoardTests.Level(
                "#####",
                "#@$.#",   // hộp ở (2,1), sau nó là đích (3,1) => đẩy được
                "#####"));
            Assert.AreEqual(MoveKind.Push, MoveResolver.Resolve(board, Direction.Right).Kind);

            var tight = Board.FromLevel(BoardTests.Level(
                "####",
                "#@$#",   // sau hộp là tường => chặn
                "####"));
            Assert.AreEqual(MoveKind.Blocked, MoveResolver.Resolve(tight, Direction.Right).Kind);
        }

        [Test]
        public void Push_BlockedWhenTwoBoxesAreAdjacent()
        {
            var board = Board.FromLevel(BoardTests.Level(
                "#######",
                "#@$$ .#",
                "#######"));

            Assert.AreEqual(MoveKind.Blocked, MoveResolver.Resolve(board, Direction.Right).Kind);
        }

        [Test]
        public void Up_DecreasesY_AndDown_IncreasesY()
        {
            var board = Board.FromLevel(BoardTests.Level(
                "###",
                "# #",
                "#@#",
                "# #",
                "###"));

            Assert.AreEqual(new Vector2Int(1, 1), MoveResolver.Resolve(board, Direction.Up).PlayerTo);
            Assert.AreEqual(new Vector2Int(1, 3), MoveResolver.Resolve(board, Direction.Down).PlayerTo);
        }

        [Test]
        public void Apply_ThenRevert_RestoresBoardExactly()
        {
            var board = Board.FromLevel(BoardTests.Level(
                "######",
                "#@$ .#",
                "######"));

            var before = board.PlayerPos;
            var move = MoveResolver.Resolve(board, Direction.Right);

            MoveResolver.Apply(board, move);
            Assert.AreEqual(new Vector2Int(2, 1), board.PlayerPos);
            Assert.IsTrue(board.Boxes.Contains(new Vector2Int(3, 1)));

            MoveResolver.Revert(board, move);
            Assert.AreEqual(before, board.PlayerPos);
            Assert.IsTrue(board.Boxes.Contains(new Vector2Int(2, 1)));
            Assert.AreEqual(1, board.Boxes.Count);
        }

        [Test]
        public void PushingBoxOffAGoal_LosesSolvedState()
        {
            // Đúng 1 hộp và 1 đích, hộp đang đứng trên đích ở (2,1) => đang thắng.
            var board = Board.FromLevel(BoardTests.Level(
                "#####",
                "#@* #",
                "#####"));

            Assert.IsTrue(board.IsSolved, "hộp đang nằm trên đích duy nhất");

            MoveResolver.Apply(board, MoveResolver.Resolve(board, Direction.Right));

            Assert.IsFalse(board.IsSolved, "đẩy hộp ra khỏi đích thì mất trạng thái thắng");
            Assert.AreEqual(CellType.Goal, board.GetCell(new Vector2Int(2, 1)),
                            "ô đích vẫn là đích sau khi hộp rời đi");
        }
    }
}
```

- [ ] **Step 3: Chạy test, xác nhận thất bại**

`run_tests` mode EditMode. Kỳ vọng: FAIL — chưa có `Board`, `MoveResolver`.

- [ ] **Step 4: Viết `CellType.cs` và `Direction.cs`**

```csharp
namespace Sokoban.Core
{
    public enum CellType { Wall, Floor, Goal }
}
```

```csharp
using UnityEngine;

namespace Sokoban.Core
{
    public enum Direction { Up, Down, Left, Right }

    public static class DirectionExtensions
    {
        /// <summary>y tăng xuống dưới, nên Up là -1 theo trục y.</summary>
        public static Vector2Int ToDelta(this Direction d) => d switch
        {
            Direction.Up => new Vector2Int(0, -1),
            Direction.Down => new Vector2Int(0, 1),
            Direction.Left => new Vector2Int(-1, 0),
            _ => new Vector2Int(1, 0)
        };

        public static Direction Opposite(this Direction d) => d switch
        {
            Direction.Up => Direction.Down,
            Direction.Down => Direction.Up,
            Direction.Left => Direction.Right,
            _ => Direction.Left
        };
    }
}
```

- [ ] **Step 5: Viết `Board.cs`**

```csharp
using System.Collections.Generic;
using Sokoban.Levels;
using UnityEngine;

namespace Sokoban.Core
{
    /// <summary>Trạng thái một màn đang chơi. Lưới tĩnh không đổi; người chơi và hộp thì đổi.</summary>
    public class Board
    {
        readonly CellType[,] _statics;

        public int Width { get; }
        public int Height { get; }
        public Vector2Int PlayerPos { get; set; }
        public HashSet<Vector2Int> Boxes { get; }

        Board(int width, int height)
        {
            Width = width;
            Height = height;
            _statics = new CellType[width, height];
            Boxes = new HashSet<Vector2Int>();
        }

        /// <summary>Ngoài lưới coi như tường, nên nơi khác không cần kiểm tra biên.</summary>
        public CellType GetCell(Vector2Int p) =>
            p.x < 0 || p.x >= Width || p.y < 0 || p.y >= Height
                ? CellType.Wall
                : _statics[p.x, p.y];

        public bool HasBox(Vector2Int p) => Boxes.Contains(p);

        public bool IsSolved
        {
            get
            {
                foreach (var b in Boxes)
                    if (GetCell(b) != CellType.Goal) return false;
                return true;
            }
        }

        public static Board FromLevel(LevelData level)
        {
            var board = new Board(level.width, level.height);

            for (int y = 0; y < level.height; y++)
            {
                string row = level.rows[y];
                for (int x = 0; x < level.width; x++)
                {
                    char c = x < row.Length ? row[x] : SokobanChars.Floor;
                    var pos = new Vector2Int(x, y);

                    board._statics[x, y] = c == SokobanChars.Wall ? CellType.Wall
                        : c == SokobanChars.Goal || c == SokobanChars.BoxOnGoal ||
                          c == SokobanChars.PlayerOnGoal ? CellType.Goal
                        : CellType.Floor;

                    if (c == SokobanChars.Player || c == SokobanChars.PlayerOnGoal)
                        board.PlayerPos = pos;
                    if (c == SokobanChars.Box || c == SokobanChars.BoxOnGoal)
                        board.Boxes.Add(pos);
                }
            }

            return board;
        }
    }
}
```

- [ ] **Step 6: Viết `MoveResult.cs` và `MoveResolver.cs`**

```csharp
using UnityEngine;

namespace Sokoban.Core
{
    public enum MoveKind { Blocked, Walk, Push }

    public struct MoveResult
    {
        public MoveKind Kind;
        public Direction Dir;
        public Vector2Int PlayerFrom;
        public Vector2Int PlayerTo;
        public Vector2Int BoxFrom;
        public Vector2Int BoxTo;

        public bool IsPush => Kind == MoveKind.Push;
        public bool IsBlocked => Kind == MoveKind.Blocked;
    }
}
```

```csharp
namespace Sokoban.Core
{
    public static class MoveResolver
    {
        /// <summary>Tính kết quả một nước đi. Hàm thuần — không đổi board.</summary>
        public static MoveResult Resolve(Board board, Direction dir)
        {
            var delta = dir.ToDelta();
            var from = board.PlayerPos;
            var to = from + delta;

            var result = new MoveResult
            {
                Kind = MoveKind.Blocked,
                Dir = dir,
                PlayerFrom = from,
                PlayerTo = from
            };

            if (board.GetCell(to) == CellType.Wall) return result;

            if (board.HasBox(to))
            {
                var boxTo = to + delta;
                if (board.GetCell(boxTo) == CellType.Wall || board.HasBox(boxTo))
                    return result;              // đẩy vào tường hoặc vào hộp khác

                result.Kind = MoveKind.Push;
                result.PlayerTo = to;
                result.BoxFrom = to;
                result.BoxTo = boxTo;
                return result;
            }

            result.Kind = MoveKind.Walk;
            result.PlayerTo = to;
            return result;
        }

        public static void Apply(Board board, MoveResult move)
        {
            if (move.IsBlocked) return;

            if (move.IsPush)
            {
                board.Boxes.Remove(move.BoxFrom);
                board.Boxes.Add(move.BoxTo);
            }
            board.PlayerPos = move.PlayerTo;
        }

        public static void Revert(Board board, MoveResult move)
        {
            if (move.IsBlocked) return;

            if (move.IsPush)
            {
                board.Boxes.Remove(move.BoxTo);
                board.Boxes.Add(move.BoxFrom);
            }
            board.PlayerPos = move.PlayerFrom;
        }
    }
}
```

- [ ] **Step 7: Chạy test, xác nhận tất cả PASS**

`run_tests` mode EditMode. Kỳ vọng: toàn bộ `BoardTests` (4) và `MoveResolverTests` (8) PASS.

- [ ] **Step 8: Commit**

```bash
cd /d/Hung/Sokoban
git add Assets/Scripts/Core Assets/Tests/EditMode/BoardTests.cs Assets/Tests/EditMode/MoveResolverTests.cs
git commit -m "Add board model and move rules with tests"
```

---

## Task 4: Undo/redo và GameSession

**Files:**
- Create: `Assets/Scripts/Core/MoveHistory.cs`
- Create: `Assets/Scripts/Core/GameSession.cs`
- Test: `Assets/Tests/EditMode/MoveHistoryTests.cs`
- Test: `Assets/Tests/EditMode/SolutionPlaythroughTests.cs`

**Interfaces:**
- Consumes: `Board`, `MoveResolver`, `MoveResult`, `Direction`, `LevelData`
- Produces:
  - `Sokoban.Core.MoveHistory` — `bool CanUndo; bool CanRedo; void Record(MoveResult); MoveResult PopForUndo(); MoveResult PopForRedo(); void Clear()`
  - `Sokoban.Core.GameSession` — `Board Board; int Moves; int Pushes; bool IsSolved; bool CanUndo; bool CanRedo; string LevelName; event Action Changed;`
    `bool TryMove(Direction); bool TryUndo(); bool TryRedo();`
    kèm ba nạp chồng `bool TryMove(Direction, out MoveResult); bool TryUndo(out MoveResult); bool TryRedo(out MoveResult);`
    và `void Restart();` — ctor `GameSession(LevelData level)`

- [ ] **Step 1: Viết test thất bại cho undo/redo**

`Assets/Tests/EditMode/MoveHistoryTests.cs`:

```csharp
using NUnit.Framework;
using Sokoban.Core;
using UnityEngine;

namespace Sokoban.Tests
{
    public class MoveHistoryTests
    {
        static GameSession Session() => new GameSession(BoardTests.Level(
            "########",
            "#@$  . #",
            "########"));

        [Test]
        public void Undo_RestoresPreviousState_IncludingPushedBox()
        {
            var s = Session();
            s.TryMove(Direction.Right);           // đẩy hộp từ (2,1) sang (3,1)

            Assert.AreEqual(new Vector2Int(2, 1), s.Board.PlayerPos);
            Assert.IsTrue(s.Board.Boxes.Contains(new Vector2Int(3, 1)));

            Assert.IsTrue(s.TryUndo());
            Assert.AreEqual(new Vector2Int(1, 1), s.Board.PlayerPos);
            Assert.IsTrue(s.Board.Boxes.Contains(new Vector2Int(2, 1)));
        }

        [Test]
        public void UndoAll_ReturnsToStartingPosition()
        {
            var s = Session();
            var startPlayer = s.Board.PlayerPos;

            s.TryMove(Direction.Right);
            s.TryMove(Direction.Right);
            s.TryMove(Direction.Right);
            while (s.TryUndo()) { }

            Assert.AreEqual(startPlayer, s.Board.PlayerPos);
            Assert.IsTrue(s.Board.Boxes.Contains(new Vector2Int(2, 1)));
            Assert.AreEqual(0, s.Moves);
            Assert.AreEqual(0, s.Pushes);
        }

        [Test]
        public void Redo_ReplaysTheUndoneMove()
        {
            var s = Session();
            s.TryMove(Direction.Right);
            s.TryUndo();

            Assert.IsTrue(s.TryRedo());
            Assert.AreEqual(new Vector2Int(2, 1), s.Board.PlayerPos);
            Assert.IsTrue(s.Board.Boxes.Contains(new Vector2Int(3, 1)));
        }

        [Test]
        public void NewMove_ClearsTheRedoBranch()
        {
            var s = Session();
            s.TryMove(Direction.Right);
            s.TryUndo();
            s.TryMove(Direction.Down);   // bị tường chặn, không được coi là nước đi

            Assert.IsTrue(s.TryRedo(), "nước bị chặn không được xoá nhánh redo");

            s.TryUndo();
            s.TryMove(Direction.Right);  // nước đi thật => xoá nhánh redo
            Assert.IsFalse(s.TryRedo());
        }

        [Test]
        public void BlockedMove_DoesNotCount()
        {
            var s = Session();
            Assert.IsFalse(s.TryMove(Direction.Up));
            Assert.AreEqual(0, s.Moves);
            Assert.IsFalse(s.TryUndo());
        }

        [Test]
        public void Counters_TrackMovesAndPushesSeparately()
        {
            var s = Session();
            s.TryMove(Direction.Right);   // đẩy
            s.TryMove(Direction.Right);   // đẩy tiếp

            Assert.AreEqual(2, s.Moves);
            Assert.AreEqual(2, s.Pushes);

            s.TryUndo();
            Assert.AreEqual(1, s.Moves);
            Assert.AreEqual(1, s.Pushes);
        }

        [Test]
        public void Restart_ResetsBoardAndCounters()
        {
            var s = Session();
            s.TryMove(Direction.Right);
            s.Restart();

            Assert.AreEqual(new Vector2Int(1, 1), s.Board.PlayerPos);
            Assert.AreEqual(0, s.Moves);
            Assert.IsFalse(s.TryUndo());
            Assert.IsFalse(s.TryRedo());
        }
    }
}
```

- [ ] **Step 2: Viết test chạy trọn lời giải**

Lời giải dưới đây được giải tay trên chính lưới ghi trong test, không phụ thuộc file ngoài.

`Assets/Tests/EditMode/SolutionPlaythroughTests.cs`:

```csharp
using NUnit.Framework;
using Sokoban.Core;

namespace Sokoban.Tests
{
    public class SolutionPlaythroughTests
    {
        static void Play(GameSession session, string moves)
        {
            foreach (char c in moves)
            {
                var dir = c switch
                {
                    'U' => Direction.Up,
                    'D' => Direction.Down,
                    'L' => Direction.Left,
                    'R' => Direction.Right,
                    _ => throw new AssertionException($"ký tự hướng lạ: {c}")
                };
                Assert.IsTrue(session.TryMove(dir), $"nước '{c}' bị chặn ngoài dự kiến");
            }
        }

        [Test]
        public void SinglePush_Solves()
        {
            var s = new GameSession(BoardTests.Level(
                "#####",
                "#@$.#",
                "#####"));

            Play(s, "R");
            Assert.IsTrue(s.IsSolved);
        }

        [Test]
        public void TwoBoxes_SolveInSequence()
        {
            //   0123456
            // 0 #######
            // 1 #@$  .#     hộp (2,1) đẩy sang đích (5,1)
            // 2 #     #
            // 3 # $  .#     hộp (2,3) đẩy sang đích (5,3)
            // 4 #######
            //
            // Hai hộp nằm khác hàng nên người chơi vòng được ra sau hộp thứ hai;
            // xếp hai hộp cùng một hàng sẽ tự chặn đường và không giải nổi.
            var s = new GameSession(BoardTests.Level(
                "#######",
                "#@$  .#",
                "#     #",
                "# $  .#",
                "#######"));

            Play(s, "RRR");          // đẩy hộp trên vào đích (5,1)
            Assert.IsFalse(s.IsSolved, "mới xong một hộp");

            Play(s, "DLLLD");        // vòng xuống hàng dưới, ra phía trái hộp thứ hai
            Play(s, "RRR");          // đẩy hộp dưới vào đích (5,3)

            Assert.IsTrue(s.IsSolved);
            Assert.AreEqual(11, s.Moves);
            Assert.AreEqual(6, s.Pushes);
        }

        [Test]
        public void PushDownwards_Solves()
        {
            //   01234
            // 0 #####
            // 1 #@  #
            // 2 # $ #
            // 3 # . #
            // 4 #####
            //
            // Người ở (1,1) đi phải tới (2,1) — ngay trên hộp — rồi đẩy xuống đích (2,3).
            var s = new GameSession(BoardTests.Level(
                "#####",
                "#@  #",
                "# $ #",
                "# . #",
                "#####"));

            Play(s, "RD");

            Assert.IsTrue(s.IsSolved);
            Assert.AreEqual(1, s.Pushes);
        }

        [Test]
        public void UndoAfterSolving_LosesSolvedState()
        {
            var s = new GameSession(BoardTests.Level(
                "#####",
                "#@$.#",
                "#####"));

            Play(s, "R");
            Assert.IsTrue(s.IsSolved);

            s.TryUndo();
            Assert.IsFalse(s.IsSolved);
        }
    }
}
```

- [ ] **Step 3: Chạy test, xác nhận thất bại**

`run_tests` mode EditMode. Kỳ vọng: FAIL — chưa có `GameSession`, `MoveHistory`.

- [ ] **Step 4: Viết `MoveHistory.cs`**

```csharp
using System.Collections.Generic;

namespace Sokoban.Core
{
    /// <summary>Hai stack: nước đã đi và nhánh đã undo. Đi nước mới thì xoá nhánh redo.</summary>
    public class MoveHistory
    {
        readonly List<MoveResult> _done = new List<MoveResult>();
        readonly List<MoveResult> _undone = new List<MoveResult>();

        public bool CanUndo => _done.Count > 0;
        public bool CanRedo => _undone.Count > 0;

        public void Record(MoveResult move)
        {
            _done.Add(move);
            _undone.Clear();
        }

        public MoveResult PopForUndo()
        {
            var move = _done[_done.Count - 1];
            _done.RemoveAt(_done.Count - 1);
            _undone.Add(move);
            return move;
        }

        public MoveResult PopForRedo()
        {
            var move = _undone[_undone.Count - 1];
            _undone.RemoveAt(_undone.Count - 1);
            _done.Add(move);
            return move;
        }

        public void Clear()
        {
            _done.Clear();
            _undone.Clear();
        }
    }
}
```

- [ ] **Step 5: Viết `GameSession.cs`**

```csharp
using System;
using Sokoban.Levels;

namespace Sokoban.Core
{
    /// <summary>Gói board + lịch sử + bộ đếm cho một lượt chơi một màn.</summary>
    public class GameSession
    {
        readonly LevelData _level;
        readonly MoveHistory _history = new MoveHistory();

        public Board Board { get; private set; }
        public int Moves { get; private set; }
        public int Pushes { get; private set; }
        public bool IsSolved => Board.IsSolved;
        public bool CanUndo => _history.CanUndo;
        public bool CanRedo => _history.CanRedo;
        public string LevelName => _level.name;

        /// <summary>Phát mỗi khi board hoặc bộ đếm đổi, để lớp hiển thị bám theo.</summary>
        public event Action Changed;

        public GameSession(LevelData level)
        {
            _level = level;
            // Viết đủ tên kiểu: thuộc tính Board trùng tên với kiểu Board, để trần dễ đọc nhầm.
            Board = Sokoban.Core.Board.FromLevel(level);
        }

        // Bản không có 'out' cho test và cho chỗ không quan tâm chi tiết;
        // bản có 'out' cho lớp hiển thị, vì animation cần biết chính xác nước nào vừa chạy.
        public bool TryMove(Direction dir) => TryMove(dir, out _);
        public bool TryUndo() => TryUndo(out _);
        public bool TryRedo() => TryRedo(out _);

        public bool TryMove(Direction dir, out MoveResult move)
        {
            move = MoveResolver.Resolve(Board, dir);
            if (move.IsBlocked) return false;

            MoveResolver.Apply(Board, move);
            _history.Record(move);
            Moves++;
            if (move.IsPush) Pushes++;

            Changed?.Invoke();
            return true;
        }

        public bool TryUndo(out MoveResult move)
        {
            move = default;
            if (!_history.CanUndo) return false;

            move = _history.PopForUndo();
            MoveResolver.Revert(Board, move);
            Moves--;
            if (move.IsPush) Pushes--;

            Changed?.Invoke();
            return true;
        }

        public bool TryRedo(out MoveResult move)
        {
            move = default;
            if (!_history.CanRedo) return false;

            move = _history.PopForRedo();
            MoveResolver.Apply(Board, move);
            Moves++;
            if (move.IsPush) Pushes++;

            Changed?.Invoke();
            return true;
        }

        public void Restart()
        {
            Board = Sokoban.Core.Board.FromLevel(_level);
            _history.Clear();
            Moves = 0;
            Pushes = 0;
            Changed?.Invoke();
        }
    }
}
```

- [ ] **Step 6: Chạy test, xác nhận tất cả PASS**

`run_tests` mode EditMode. Kỳ vọng: `MoveHistoryTests` (7) và `SolutionPlaythroughTests` (4) PASS.

- [ ] **Step 7: Commit**

```bash
cd /d/Hung/Sokoban
git add Assets/Scripts/Core Assets/Tests/EditMode/MoveHistoryTests.cs Assets/Tests/EditMode/SolutionPlaythroughTests.cs
git commit -m "Add undo/redo history and game session with tests"
```

---

## Task 5: Art Kenney, Tile asset và scene Main

**Files:**
- Create: `Assets/Art/Kenney/` (sprite giải nén)
- Create: `Assets/Tiles/GroundTile.asset`, `GoalTile.asset`, `WallTile.asset`
- Create: `Assets/Scenes/Main.unity`
- Delete: `Assets/Scenes/SampleScene.unity`, `Assets/Scenes/New Scene.unity`
- Create: `Assets/Art/Kenney/License.txt` (giữ nguyên giấy phép CC0)

**Interfaces:**
- Consumes: —
- Produces: scene `Main.unity` với cây GameObject:
  `Grid` → `GroundTilemap`, `GoalTilemap`, `WallTilemap` (mỗi cái có `Tilemap` + `TilemapRenderer`);
  `Board` (GameObject rỗng, nơi spawn người chơi và hộp); `Main Camera` (orthographic);
  `Canvas` (Screen Space – Overlay, `CanvasScaler` Scale With Screen Size 1920×1080, Match 0.5);
  `EventSystem`. Ba Tile asset dùng ở Task 6.

- [ ] **Step 1: Tải và giải nén bộ Kenney**

```bash
cd /d/Hung/Sokoban
curl -L -o /tmp/kenney_sokoban.zip \
  "https://kenney.nl/media/pages/assets/sokoban/470af8da72-1677579120/kenney_sokoban-pack.zip"
mkdir -p Assets/Art/Kenney
unzip -o /tmp/kenney_sokoban.zip -d /tmp/kenney_sokoban
cp "/tmp/kenney_sokoban/PNG/Default size/Ground/ground_01.png"            Assets/Art/Kenney/
cp "/tmp/kenney_sokoban/PNG/Default size/Blocks/block_06.png"             Assets/Art/Kenney/
cp "/tmp/kenney_sokoban/PNG/Default size/Environment/environment_05.png"  Assets/Art/Kenney/
cp "/tmp/kenney_sokoban/PNG/Default size/Crates/crate_02.png"             Assets/Art/Kenney/
cp "/tmp/kenney_sokoban/PNG/Default size/Crates/crate_07.png"             Assets/Art/Kenney/
cp "/tmp/kenney_sokoban/PNG/Default size/Player/player_01.png"            Assets/Art/Kenney/
cp "/tmp/kenney_sokoban/License.txt"                                      Assets/Art/Kenney/
ls -1 Assets/Art/Kenney/
```

Kỳ vọng: 7 file. Zip khoảng 1 606 642 byte; mỗi sprite 64×64. Nếu tải hỏng, **dừng và hỏi người dùng**.

- [ ] **Step 2: Đặt import setting cho sprite**

Với cả 6 file PNG (`read_console` sau mỗi bước để bắt lỗi): Texture Type = **Sprite (2D and UI)**,
Sprite Mode = Single, **Pixels Per Unit = 64** (một tile = đúng 1 unit), Filter Mode = **Point (no filter)**,
Compression = **None**, Generate Mip Maps = tắt.

Dùng MCP `manage_asset` hoặc sửa `.meta`; sau đó `refresh_unity` và kiểm tra console.

Pixels Per Unit 64 rất quan trọng: nó làm 1 ô lưới = 1 unit, khớp với `Grid` mặc định (Cell Size 1×1×0),
nên toạ độ bàn cờ ánh xạ thẳng sang toạ độ world mà không cần nhân chia.

- [ ] **Step 3: Tạo ba Tile asset**

Trong Unity: **Assets → Create → 2D → Tiles → Tile**, tạo tại `Assets/Tiles/`:

| Asset | Sprite gán vào |
|---|---|
| `GroundTile.asset` | `ground_01` |
| `GoalTile.asset` | `environment_05` |
| `WallTile.asset` | `block_06` |

- [ ] **Step 4: Dựng scene `Main.unity`**

Tạo scene mới, lưu thành `Assets/Scenes/Main.unity`, dựng cây:

- `Main Camera` — Projection **Orthographic**, Size 6, Position `(0, 0, -10)`, Clear Flags Solid Color,
  Background màu tối (ví dụ `#1E1E28`).
- `Grid` (GameObject → 2D Object → Tilemap → Rectangular) — Cell Size `(1, 1, 0)`. Đổi tên ba Tilemap con
  thành `GroundTilemap`, `GoalTilemap`, `WallTilemap`; nếu chỉ có một thì nhân bản thêm.
  Đặt `TilemapRenderer.sortingOrder`: Ground = 0, Goal = 1, Wall = 2.
- `Board` — GameObject rỗng ở gốc `(0, 0, 0)`, là cha của người chơi và hộp khi spawn.
- `Canvas` — Render Mode **Screen Space – Overlay**; `CanvasScaler` UI Scale Mode = **Scale With Screen Size**,
  Reference Resolution `1920×1080`, Match `0.5`. Kèm `EventSystem` (tự sinh khi thêm Canvas).
- Xoá `SampleScene.unity` và `New Scene.unity`.
- **File → Build Settings**: thêm `Main.unity` và bỏ mọi scene khác, để `Main` là scene duy nhất được build.

- [ ] **Step 5: Xác nhận scene sạch**

Gọi `read_console` — kỳ vọng 0 lỗi 0 cảnh báo. Bấm Play rồi Stop; scene vẫn trống nhưng không được ném lỗi.

**Lưu ý bẫy đã gặp ở project trước:** chế độ *fast enter play mode* có thể để lọt thay đổi runtime vào
scene đã lưu. Sau khi Play xong, chạy `git diff Assets/Scenes/Main.unity` và bỏ mọi thay đổi ngoài ý muốn.

- [ ] **Step 6: Commit**

```bash
cd /d/Hung/Sokoban
git add Assets/Art Assets/Tiles Assets/Scenes ProjectSettings/EditorBuildSettings.asset
git commit -m "Add Kenney art, tile assets and the Main scene"
```

---

## Task 6: Vẽ màn ra màn hình

**Files:**
- Create: `Assets/Scripts/View/BoardRenderer.cs`
- Create: `Assets/Scripts/View/CameraFitter.cs`
- Modify: `Assets/Scenes/Main.unity` (gắn component, tạo prefab)
- Create: `Assets/Prefabs/Player.prefab`, `Assets/Prefabs/Box.prefab`

**Interfaces:**
- Consumes: `Board`, `CellType`, `LevelData`, `LevelCollection`
- Produces:
  - `Sokoban.View.BoardRenderer` (MonoBehaviour) — `void Render(Board board);` `void SetBoxSprite(Vector2Int cell, bool onGoal);`
    `void MoveBoxRecord(Vector2Int from, Vector2Int to);`
    `Transform GetPlayerTransform();` `Transform GetBoxTransform(Vector2Int cell);`
    `static Vector3 CellToWorld(Vector2Int cell)` → `new Vector3(cell.x + 0.5f, -cell.y - 0.5f, 0)`
  - `Sokoban.View.CameraFitter` — `void Fit(int width, int height)`

- [ ] **Step 1: Tạo prefab Player và Box**

`Assets/Prefabs/Player.prefab`: GameObject có `SpriteRenderer` (sprite `player_01`, Sorting Order **10**).
`Assets/Prefabs/Box.prefab`: GameObject có `SpriteRenderer` (sprite `crate_02`, Sorting Order **5**).
Cả hai để scale `(1, 1, 1)` — với Pixels Per Unit 64 thì sprite vừa đúng một ô.

- [ ] **Step 2: Viết `BoardRenderer.cs`**

```csharp
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
        [SerializeField] TileBase goalTile;
        [SerializeField] TileBase wallTile;

        [Header("Prefabs")]
        [SerializeField] GameObject playerPrefab;
        [SerializeField] GameObject boxPrefab;
        [SerializeField] Transform boardRoot;

        [Header("Box sprites")]
        [SerializeField] Sprite boxSprite;
        [SerializeField] Sprite boxOnGoalSprite;

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
                    // Toạ độ Tilemap là góc dưới-trái của ô, nên hàng y nằm ở [-y-1, -y]
                    // và tâm ô rơi đúng vào CellToWorld. Bỏ "-1" là lệch cả bàn cờ một ô.
                    var pos = new Vector3Int(x, -y - 1, 0);
                    var type = board.GetCell(cell);

                    if (type == CellType.Wall)
                    {
                        wallTilemap.SetTile(pos, Resolve(wallTile, "wall"));
                        continue;
                    }

                    groundTilemap.SetTile(pos, Resolve(groundTile, "ground"));
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
```

- [ ] **Step 3: Viết `CameraFitter.cs`**

```csharp
using UnityEngine;

namespace Sokoban.View
{
    /// <summary>Canh camera sao cho cả màn vừa khung, kèm lề, dù màn to hay nhỏ.</summary>
    [RequireComponent(typeof(Camera))]
    public class CameraFitter : MonoBehaviour
    {
        [SerializeField] float margin = 1.5f;
        [SerializeField] float minSize = 4f;

        Camera _camera;

        void Awake() => _camera = GetComponent<Camera>();

        public void Fit(int width, int height)
        {
            if (_camera == null) _camera = GetComponent<Camera>();

            // Bàn cờ trải từ x = 0..width và y = 0..-height, nên tâm nằm ở đây.
            var center = new Vector3(width * 0.5f, -height * 0.5f, transform.position.z);
            transform.position = center;

            float halfHeight = height * 0.5f + margin;
            float halfWidthAsHeight = (width * 0.5f + margin) / Mathf.Max(_camera.aspect, 0.0001f);

            _camera.orthographicSize = Mathf.Max(minSize, halfHeight, halfWidthAsHeight);
        }
    }
}
```

- [ ] **Step 4: Gắn vào scene và thử bằng một màn cụ thể**

Thêm `BoardRenderer` vào GameObject `Board`, gán đủ 3 Tilemap, 3 Tile, 2 prefab, 2 sprite hộp và `boardRoot`.
Thêm `CameraFitter` vào `Main Camera`.

Tạo tạm `Assets/Scripts/View/RenderSmokeTest.cs` để nhìn thấy kết quả:

```csharp
using Sokoban.Core;
using Sokoban.Levels;
using UnityEngine;

namespace Sokoban.View
{
    /// <summary>Tạm thời: vẽ một màn ngay khi Play để mắt thường kiểm chứng. Xoá ở Task 7.</summary>
    public class RenderSmokeTest : MonoBehaviour
    {
        [SerializeField] LevelCollection collection;
        [SerializeField] int levelIndex;
        [SerializeField] BoardRenderer boardRenderer;
        [SerializeField] CameraFitter cameraFitter;

        void Start()
        {
            var level = collection.levels[levelIndex];
            var board = Board.FromLevel(level);

            boardRenderer.Render(board);
            cameraFitter.Fit(level.width, level.height);
        }
    }
}
```

- [ ] **Step 5: Bấm Play và kiểm chứng bằng mắt**

Gán `collection` = `Microban.asset`, `levelIndex` = 0. Bấm Play.
Kỳ vọng: màn 1 hiện đúng — tường gạch xám bao quanh, nền nâu, một kim cương đỏ ở ô đích trống,
một hộp nâu nhạt, một hộp nâu sẫm (hộp đã nằm trên đích), người chơi ở giữa; cả màn nằm gọn trong khung hình.

Đổi `levelIndex` sang 154 (màn lớn nhất, 30×17) và Play lại — vẫn phải vừa khung, không bị cắt.

Chụp lại màn hình để đối chiếu. Sau khi Stop, chạy `git diff Assets/Scenes/Main.unity` và bỏ thay đổi lọt vào scene.

- [ ] **Step 6: Commit**

```bash
cd /d/Hung/Sokoban
git add Assets/Scripts/View Assets/Prefabs Assets/Scenes/Main.unity
git commit -m "Render levels onto tilemaps with camera fitting"
```

---

## Task 7: Điều khiển và chơi được

**Files:**
- Create: `Assets/Scripts/Input/InputRouter.cs`
- Create: `Assets/Scripts/View/LevelPlayer.cs`
- Delete: `Assets/Scripts/View/RenderSmokeTest.cs`
- Modify: `Assets/Scenes/Main.unity`

**Interfaces:**
- Consumes: `GameSession`, `BoardRenderer`, `CameraFitter`, `LevelCollection`
- Produces:
  - `Sokoban.InputSystem.InputRouter` (MonoBehaviour) — `event Action<Direction> Moved; event Action UndoPressed; event Action RedoPressed; event Action RestartPressed; event Action ExitPressed;`
  - `Sokoban.View.LevelPlayer` (MonoBehaviour) — `void LoadLevel(LevelCollection collection, int index);`
    `GameSession Session { get; }` `event Action Solved;` `event Action ExitRequested;`
    `void RequestUndo(); void RequestRedo(); void RequestRestart();`
    (Ba method `Request*` là **đường vào duy nhất** cho nút bấm trên HUD ở Task 11 — gọi thẳng
    `Session.TryUndo()` từ UI sẽ đổi trạng thái logic mà không cập nhật animation lẫn sổ tay vị trí hộp.)

- [ ] **Step 1: Viết `InputRouter.cs`**

```csharp
using System;
using Sokoban.Core;
using UnityEngine;

namespace Sokoban.InputSystem
{
    /// <summary>Gom bàn phím và vuốt thành một luồng lệnh duy nhất.</summary>
    public class InputRouter : MonoBehaviour
    {
        [SerializeField] float swipeThreshold = 40f;   // pixel

        public event Action<Direction> Moved;
        public event Action UndoPressed;
        public event Action RedoPressed;
        public event Action RestartPressed;
        public event Action ExitPressed;

        Vector2 _touchStart;
        bool _tracking;

        void Update()
        {
            ReadKeyboard();
            ReadSwipe();
        }

        void ReadKeyboard()
        {
            if (Input.GetKeyDown(KeyCode.UpArrow) || Input.GetKeyDown(KeyCode.W)) Moved?.Invoke(Direction.Up);
            if (Input.GetKeyDown(KeyCode.DownArrow) || Input.GetKeyDown(KeyCode.S)) Moved?.Invoke(Direction.Down);
            if (Input.GetKeyDown(KeyCode.LeftArrow) || Input.GetKeyDown(KeyCode.A)) Moved?.Invoke(Direction.Left);
            if (Input.GetKeyDown(KeyCode.RightArrow) || Input.GetKeyDown(KeyCode.D)) Moved?.Invoke(Direction.Right);

            if (Input.GetKeyDown(KeyCode.U)) UndoPressed?.Invoke();
            if (Input.GetKeyDown(KeyCode.Y)) RedoPressed?.Invoke();
            if (Input.GetKeyDown(KeyCode.R)) RestartPressed?.Invoke();
            if (Input.GetKeyDown(KeyCode.Escape)) ExitPressed?.Invoke();
        }

        void ReadSwipe()
        {
            if (Input.touchCount > 0)
            {
                var touch = Input.GetTouch(0);
                if (touch.phase == TouchPhase.Began) { _touchStart = touch.position; _tracking = true; }
                else if (touch.phase == TouchPhase.Ended && _tracking)
                {
                    _tracking = false;
                    EmitSwipe(touch.position - _touchStart);
                }
                return;
            }

            // Chuột kéo cũng tính là vuốt, để thử nhanh trên desktop.
            if (Input.GetMouseButtonDown(0)) { _touchStart = Input.mousePosition; _tracking = true; }
            else if (Input.GetMouseButtonUp(0) && _tracking)
            {
                _tracking = false;
                EmitSwipe((Vector2)Input.mousePosition - _touchStart);
            }
        }

        void EmitSwipe(Vector2 delta)
        {
            if (delta.magnitude < swipeThreshold) return;   // chạm nhẹ, không phải vuốt

            // Trục nào dài hơn thì thắng.
            if (Mathf.Abs(delta.x) > Mathf.Abs(delta.y))
                Moved?.Invoke(delta.x > 0 ? Direction.Right : Direction.Left);
            else
                Moved?.Invoke(delta.y > 0 ? Direction.Up : Direction.Down);   // màn hình y hướng lên
        }
    }
}
```

Lưu ý dấu: trên màn hình, y tăng lên trên, nên vuốt lên `delta.y > 0` là `Direction.Up` — đúng chiều
người chơi mong đợi, và `Direction.Up` bên trong lại là `y - 1` của bàn cờ. Hai quy ước ngược nhau
nhưng đã được quy đổi đúng ở đây.

- [ ] **Step 2: Viết `LevelPlayer.cs`**

```csharp
using System;
using Sokoban.Core;
using Sokoban.InputSystem;
using Sokoban.Levels;
using UnityEngine;

namespace Sokoban.View
{
    /// <summary>Nối input với GameSession và cập nhật hiển thị.</summary>
    public class LevelPlayer : MonoBehaviour
    {
        [SerializeField] BoardRenderer boardRenderer;
        [SerializeField] CameraFitter cameraFitter;
        [SerializeField] InputRouter input;

        public GameSession Session { get; private set; }
        public event Action Solved;
        public event Action ExitRequested;

        void OnEnable()
        {
            input.Moved += OnMoved;
            input.UndoPressed += OnUndo;
            input.RedoPressed += OnRedo;
            input.RestartPressed += OnRestart;
            input.ExitPressed += () => ExitRequested?.Invoke();
        }

        void OnDisable()
        {
            input.Moved -= OnMoved;
            input.UndoPressed -= OnUndo;
            input.RedoPressed -= OnRedo;
            input.RestartPressed -= OnRestart;
        }

        public void LoadLevel(LevelCollection collection, int index)
        {
            var level = collection.levels[index];
            Session = new GameSession(level);

            boardRenderer.Render(Session.Board);
            cameraFitter.Fit(level.width, level.height);
        }

        void OnMoved(Direction dir)
        {
            if (Session == null) return;
            if (!Session.TryMove(dir)) return;

            boardRenderer.Render(Session.Board);      // Task 8 thay bằng tween
            if (Session.IsSolved) Solved?.Invoke();
        }

        // Cả phím tắt lẫn nút trên HUD (Task 11) đều đi qua ba method này — không có đường tắt nào khác.
        public void RequestUndo() => OnUndo();
        public void RequestRedo() => OnRedo();
        public void RequestRestart() => OnRestart();

        void OnUndo()
        {
            if (Session != null && Session.TryUndo()) boardRenderer.Render(Session.Board);
        }

        void OnRedo()
        {
            if (Session != null && Session.TryRedo()) boardRenderer.Render(Session.Board);
        }

        void OnRestart()
        {
            if (Session == null) return;
            Session.Restart();
            boardRenderer.Render(Session.Board);
        }
    }
}
```

- [ ] **Step 3: Gắn vào scene, xoá smoke test**

Thêm `InputRouter` và `LevelPlayer` vào `Board`, gán tham chiếu. Xoá `RenderSmokeTest.cs` và component của nó.
Tạm thời gọi `LoadLevel(collection, 0)` trong `Start` của `LevelPlayer` để thử (Task 11 sẽ thay bằng `GameFlowController`).

- [ ] **Step 4: Chơi thử màn 1 tới khi thắng**

Bấm Play. Dùng mũi tên đẩy hộp vào ô đích cho tới khi thắng.
Kỳ vọng: đi đúng hướng, không xuyên tường, không đẩy được hai hộp liền nhau, hộp đổi sang sprite nâu sẫm
khi vào đích, `U` lùi được từng nước, `R` chơi lại từ đầu.
Kéo chuột 4 hướng để kiểm tra nhánh vuốt.

- [ ] **Step 5: Commit**

```bash
cd /d/Hung/Sokoban
git add Assets/Scripts Assets/Scenes/Main.unity
git commit -m "Wire keyboard and swipe input into a playable level"
```

---

## Task 8: Animation mượt và đệm input

**Files:**
- Create: `Assets/Scripts/View/MoveAnimator.cs`
- Modify: `Assets/Scripts/View/LevelPlayer.cs`
- Modify: `Assets/Scripts/View/BoardRenderer.cs` (dùng `MoveBoxRecord` khi đẩy)

**Interfaces:**
- Consumes: `BoardRenderer`, `MoveResult`, `GameSession`
- Produces:
  - `Sokoban.View.MoveAnimator` — `bool IsAnimating { get; }` `void Play(MoveResult move, bool reversed, Action onComplete)`

- [ ] **Step 1: Viết `MoveAnimator.cs`**

```csharp
using System;
using System.Collections;
using Sokoban.Core;
using UnityEngine;

namespace Sokoban.View
{
    /// <summary>Trượt người chơi và hộp giữa hai ô trong 0.12 giây.</summary>
    public class MoveAnimator : MonoBehaviour
    {
        [SerializeField] BoardRenderer boardRenderer;
        [SerializeField] float duration = 0.12f;

        public bool IsAnimating { get; private set; }

        /// <param name="reversed">true khi undo — người và hộp chạy ngược lại.</param>
        public void Play(MoveResult move, bool reversed, Action onComplete)
        {
            StartCoroutine(PlayRoutine(move, reversed, onComplete));
        }

        IEnumerator PlayRoutine(MoveResult move, bool reversed, Action onComplete)
        {
            IsAnimating = true;

            var playerFrom = BoardRenderer.CellToWorld(reversed ? move.PlayerTo : move.PlayerFrom);
            var playerTo = BoardRenderer.CellToWorld(reversed ? move.PlayerFrom : move.PlayerTo);

            Transform player = boardRenderer.GetPlayerTransform();
            Transform box = null;
            Vector3 boxFrom = default, boxTo = default;

            if (move.IsPush)
            {
                // Người gọi đã chạy MoveBoxRecord TRƯỚC khi gọi Play, nên trong sổ tay hộp
                // đã nằm ở ô đích của lần trượt này — tra theo ô đích, không phải ô xuất phát.
                var boxKey = reversed ? move.BoxFrom : move.BoxTo;
                box = boardRenderer.GetBoxTransform(boxKey);

                boxFrom = BoardRenderer.CellToWorld(reversed ? move.BoxTo : move.BoxFrom);
                boxTo = BoardRenderer.CellToWorld(reversed ? move.BoxFrom : move.BoxTo);
            }

            float elapsed = 0f;
            while (elapsed < duration)
            {
                elapsed += Time.deltaTime;
                float t = Mathf.Clamp01(elapsed / duration);

                if (player != null) player.position = Vector3.Lerp(playerFrom, playerTo, t);
                if (box != null) box.position = Vector3.Lerp(boxFrom, boxTo, t);
                yield return null;
            }

            if (player != null) player.position = playerTo;
            if (box != null) box.position = boxTo;

            IsAnimating = false;
            onComplete?.Invoke();
        }
    }
}
```

- [ ] **Step 2: Sửa `LevelPlayer` để dùng animator và đệm 1 nước**

Thay các chỗ gọi `boardRenderer.Render(...)` sau mỗi nước bằng: cập nhật sổ tay hộp, chạy animation,
và giữ **tối đa một** nước chờ. Thêm trường `[SerializeField] MoveAnimator animator;` và:

```csharp
        Direction? _buffered;

        void DrainBuffer()
        {
            if (_buffered == null) return;

            var next = _buffered.Value;
            _buffered = null;
            OnMoved(next);
        }
```

Undo và redo cũng phải đi qua animator, và phải cập nhật sổ tay vị trí hộp **trước** khi chạy animation
— vì `MoveAnimator` tra `GetBoxTransform` theo ô hiện tại của hộp:

```csharp
        void OnUndo()
        {
            if (Session == null || animator.IsAnimating) return;
            if (!Session.TryUndo(out var move)) return;

            // Undo kéo hộp từ ô đích cũ về ô xuất phát.
            if (move.IsPush) boardRenderer.MoveBoxRecord(move.BoxTo, move.BoxFrom);

            animator.Play(move, reversed: true, onComplete: () =>
            {
                if (move.IsPush)
                    boardRenderer.SetBoxSprite(move.BoxFrom,
                        Session.Board.GetCell(move.BoxFrom) == CellType.Goal);
            });
        }

        void OnRedo()
        {
            if (Session == null || animator.IsAnimating) return;
            if (!Session.TryRedo(out var move)) return;

            if (move.IsPush) boardRenderer.MoveBoxRecord(move.BoxFrom, move.BoxTo);

            animator.Play(move, reversed: false, onComplete: () =>
            {
                if (move.IsPush)
                    boardRenderer.SetBoxSprite(move.BoxTo,
                        Session.Board.GetCell(move.BoxTo) == CellType.Goal);

                if (Session.IsSolved) Solved?.Invoke();
            });
        }

        void OnRestart()
        {
            if (Session == null) return;

            _buffered = null;                    // bỏ nước đang chờ, nếu không nó sẽ chạy lên bàn cờ mới
            Session.Restart();
            boardRenderer.Render(Session.Board); // vẽ lại toàn bộ, không tween
        }
```

Và `OnMoved` viết lại như sau. Dùng nạp chồng có `out` chứ đừng gọi `MoveResolver.Resolve` rồi
`Session.TryMove` tách rời — làm vậy là giải cùng một nước hai lần, và hai kết quả có thể lệch nhau:

```csharp
        void OnMoved(Direction dir)
        {
            if (Session == null) return;

            if (animator.IsAnimating)
            {
                _buffered = dir;      // chỉ giữ nước mới nhất, đúng "đệm tối đa 1 nước"
                return;
            }

            if (!Session.TryMove(dir, out var move)) return;
            if (move.IsPush) boardRenderer.MoveBoxRecord(move.BoxFrom, move.BoxTo);

            animator.Play(move, reversed: false, onComplete: () =>
            {
                if (move.IsPush)
                    boardRenderer.SetBoxSprite(move.BoxTo,
                        Session.Board.GetCell(move.BoxTo) == CellType.Goal);

                if (Session.IsSolved) Solved?.Invoke();
                DrainBuffer();
            });
        }
```

- [ ] **Step 3: Chơi thử, kiểm tra cảm giác**

Bấm Play. Giữ phím mũi tên: nhân vật phải đi liên tục mượt, không khựng, không nhảy cóc.
Undo liên tiếp: hộp phải trượt ngược đúng đường. Không được có nước nào bị nuốt mất hay chạy hai lần.

- [ ] **Step 4: Commit**

```bash
cd /d/Hung/Sokoban
git add Assets/Scripts/View
git commit -m "Add tweened movement with single-move input buffering"
```

---

## Task 9: Lưu tiến độ

**Files:**
- Create: `Assets/Scripts/Progress/ProgressStore.cs`
- Test: `Assets/Tests/EditMode/ProgressStoreTests.cs`

**Interfaces:**
- Consumes: —
- Produces:
  - `Sokoban.Progress.LevelRecord` — `int index; bool completed; int bestMoves; int bestPushes;`
  - `Sokoban.Progress.ProgressStore` — `static void RecordCompletion(string collection, int index, int moves, int pushes);`
    `static LevelRecord GetRecord(string collection, int index); static bool IsUnlocked(string collection, int index);`
    `static int GetLastPlayedIndex(string collection); static void SetLastPlayedIndex(string collection, int index);`
    `static bool Muted { get; set; } static void Clear();`

- [ ] **Step 1: Viết test thất bại**

`Assets/Tests/EditMode/ProgressStoreTests.cs`:

```csharp
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
```

- [ ] **Step 2: Chạy test, xác nhận thất bại**

`run_tests` mode EditMode. Kỳ vọng: FAIL — chưa có `ProgressStore`.

- [ ] **Step 3: Viết `ProgressStore.cs`**

```csharp
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
```

- [ ] **Step 4: Chạy test, xác nhận tất cả PASS**

`run_tests` mode EditMode. Kỳ vọng: 6/6 `ProgressStoreTests` PASS.

- [ ] **Step 5: Commit**

```bash
cd /d/Hung/Sokoban
git add Assets/Scripts/Progress Assets/Tests/EditMode/ProgressStoreTests.cs
git commit -m "Add progress store with sequential unlocking and best scores"
```

---

## Task 10: Luồng UI và chọn màn

**Files:**
- Create: `Assets/Scripts/UI/GameFlowController.cs`
- Create: `Assets/Scripts/UI/MainMenuPanel.cs`
- Create: `Assets/Scripts/UI/LevelSelectPanel.cs`
- Create: `Assets/Scripts/UI/LevelButtonView.cs`
- Create: `Assets/Prefabs/LevelButton.prefab`
- Modify: `Assets/Scenes/Main.unity`

**Interfaces:**
- Consumes: `ProgressStore`, `LevelCollection`, `LevelPlayer`
- Produces:
  - `Sokoban.UI.GameFlowController` — `void ShowMainMenu(); void ShowLevelSelect(); void StartLevel(int index); void ContinueGame();`
  - `Sokoban.UI.MainMenuPanel` — `void Show(); void Hide();`
  - `Sokoban.UI.LevelSelectPanel` — `void Show(); void Hide(); void Rebuild();`

- [ ] **Step 1: Dựng ba panel trong Canvas**

Dưới `Canvas`, tạo ba GameObject con, mỗi cái phủ toàn màn hình (anchor stretch cả hai chiều):

- `MainMenuPanel` — tiêu đề "SOKOBAN" (TextMeshProUGUI), 4 nút dọc: **Chơi tiếp**, **Chọn màn**,
  **Tắt tiếng**, **Hướng dẫn**. Dưới cùng là một `TextMeshProUGUI` hướng dẫn ngắn:
  "Mũi tên hoặc WASD để đi · U hoàn tác · Y làm lại · R chơi lại màn".
- `LevelSelectPanel` — `Scroll View` (Vertical) chứa `Content` có `GridLayoutGroup`
  (Cell Size 120×120, Spacing 12, Constraint = Fixed Column Count, 6 cột) và `ContentSizeFitter`
  (Vertical = Preferred Size). Kèm nút **Quay lại**, và một `TextMeshProUGUI` `EmptyLabel` báo khi
  collection rỗng.
- `HudPanel` — để trống ở task này, Task 11 sẽ dựng.

`LevelButton.prefab`: `Button` + `TextMeshProUGUI` số màn ở giữa, một `TextMeshProUGUI` nhỏ phía dưới
cho số bước tốt nhất, và một `Image` dấu tick ở góc.

- [ ] **Step 2: Viết `MainMenuPanel.cs`**

```csharp
using Sokoban.Progress;
using TMPro;
using UnityEngine;
using UnityEngine.UI;

namespace Sokoban.UI
{
    public class MainMenuPanel : MonoBehaviour
    {
        [SerializeField] GameFlowController flow;
        [SerializeField] Button continueButton;
        [SerializeField] Button levelSelectButton;
        [SerializeField] Button muteButton;
        [SerializeField] TextMeshProUGUI muteLabel;

        void Awake()
        {
            continueButton.onClick.AddListener(() => flow.ContinueGame());
            levelSelectButton.onClick.AddListener(() => flow.ShowLevelSelect());
            muteButton.onClick.AddListener(ToggleMute);
        }

        void ToggleMute()
        {
            ProgressStore.Muted = !ProgressStore.Muted;
            RefreshMuteLabel();
        }

        void RefreshMuteLabel() =>
            muteLabel.text = ProgressStore.Muted ? "Bật tiếng" : "Tắt tiếng";

        public void Show()
        {
            gameObject.SetActive(true);
            RefreshMuteLabel();
        }

        public void Hide() => gameObject.SetActive(false);
    }
}
```

- [ ] **Step 3: Viết `LevelSelectPanel.cs`**

```csharp
using System.Collections.Generic;
using Sokoban.Levels;
using Sokoban.Progress;
using TMPro;
using UnityEngine;
using UnityEngine.UI;

namespace Sokoban.UI
{
    public class LevelSelectPanel : MonoBehaviour
    {
        [SerializeField] GameFlowController flow;
        [SerializeField] LevelCollection collection;
        [SerializeField] Transform content;
        [SerializeField] GameObject levelButtonPrefab;
        [SerializeField] Button backButton;
        [SerializeField] TextMeshProUGUI emptyLabel;

        readonly List<GameObject> _buttons = new List<GameObject>();

        void Awake() => backButton.onClick.AddListener(() => flow.ShowMainMenu());

        public void Show()
        {
            gameObject.SetActive(true);
            Rebuild();
        }

        public void Hide() => gameObject.SetActive(false);

        public void Rebuild()
        {
            foreach (var go in _buttons) Destroy(go);
            _buttons.Clear();

            bool empty = collection == null || collection.levels == null || collection.levels.Count == 0;
            emptyLabel.gameObject.SetActive(empty);
            if (empty)
            {
                // Thà báo rõ còn hơn để người chơi nhìn một màn hình trắng.
                emptyLabel.text = "Chưa có màn nào. Chạy menu Sokoban → Import Microban .txt…";
                return;
            }

            for (int i = 0; i < collection.levels.Count; i++)
            {
                int index = i;
                var go = Instantiate(levelButtonPrefab, content);
                _buttons.Add(go);

                var view = go.GetComponent<LevelButtonView>();
                var record = ProgressStore.GetRecord(collection.collectionName, index);
                bool unlocked = ProgressStore.IsUnlocked(collection.collectionName, index);

                view.Bind(index + 1, record.completed, unlocked,
                          record.completed ? record.bestMoves : 0,
                          () => flow.StartLevel(index));
            }
        }
    }
}
```

Kèm `Assets/Scripts/UI/LevelButtonView.cs`:

```csharp
using System;
using TMPro;
using UnityEngine;
using UnityEngine.UI;

namespace Sokoban.UI
{
    public class LevelButtonView : MonoBehaviour
    {
        [SerializeField] Button button;
        [SerializeField] TextMeshProUGUI numberLabel;
        [SerializeField] TextMeshProUGUI bestLabel;
        [SerializeField] GameObject tick;
        [SerializeField] CanvasGroup canvasGroup;

        public void Bind(int displayNumber, bool completed, bool unlocked, int bestMoves, Action onClick)
        {
            numberLabel.text = displayNumber.ToString();
            tick.SetActive(completed);
            bestLabel.text = completed ? $"{bestMoves} bước" : "";

            button.interactable = unlocked;
            canvasGroup.alpha = unlocked ? 1f : 0.35f;

            button.onClick.RemoveAllListeners();
            if (unlocked) button.onClick.AddListener(() => onClick());
        }
    }
}
```

- [ ] **Step 4: Viết `GameFlowController.cs`**

```csharp
using Sokoban.Levels;
using Sokoban.Progress;
using Sokoban.View;
using UnityEngine;

namespace Sokoban.UI
{
    /// <summary>Bật/tắt các panel và quyết định đang ở màn hình nào.</summary>
    public class GameFlowController : MonoBehaviour
    {
        [SerializeField] LevelCollection collection;
        [SerializeField] LevelPlayer levelPlayer;
        [SerializeField] MainMenuPanel mainMenu;
        [SerializeField] LevelSelectPanel levelSelect;
        [SerializeField] GameObject boardRoot;

        int _currentIndex;

        void Start()
        {
            levelPlayer.Solved += OnSolved;
            levelPlayer.ExitRequested += ShowLevelSelect;
            ShowMainMenu();
        }

        public void ShowMainMenu()
        {
            mainMenu.Show();
            levelSelect.Hide();
            boardRoot.SetActive(false);
        }

        public void ShowLevelSelect()
        {
            mainMenu.Hide();
            levelSelect.Show();
            boardRoot.SetActive(false);
        }

        public void ContinueGame() => StartLevel(ProgressStore.GetLastPlayedIndex(collection.collectionName));

        public void StartLevel(int index)
        {
            if (collection.levels.Count == 0) { ShowLevelSelect(); return; }

            _currentIndex = Mathf.Clamp(index, 0, collection.levels.Count - 1);
            ProgressStore.SetLastPlayedIndex(collection.collectionName, _currentIndex);

            mainMenu.Hide();
            levelSelect.Hide();
            boardRoot.SetActive(true);

            levelPlayer.LoadLevel(collection, _currentIndex);
        }

        void OnSolved()
        {
            var session = levelPlayer.Session;

            ProgressStore.RecordCompletion(collection.collectionName, _currentIndex,
                                           session.Moves, session.Pushes);

            // Task 11 thay dòng này bằng panel thắng màn.
            Debug.Log($"Xong màn {_currentIndex + 1} trong {session.Moves} bước");
            ShowLevelSelect();
        }

        public void NextLevel() => StartLevel(_currentIndex + 1);
        public void ReplayLevel() => StartLevel(_currentIndex);
    }
}
```

- [ ] **Step 5: Chạy thử luồng**

Bấm Play. Kỳ vọng: hiện MainMenu → **Chọn màn** ra lưới 155 nút, chỉ nút 1 bấm được, các nút sau mờ →
bấm nút 1 vào chơi → thắng màn → quay lại LevelSelect thấy nút 1 có tick kèm số bước và nút 2 đã mở.

- [ ] **Step 6: Commit**

```bash
cd /d/Hung/Sokoban
git add Assets/Scripts/UI Assets/Prefabs Assets/Scenes/Main.unity
git commit -m "Add main menu, level select and game flow"
```

---

## Task 11: HUD và panel thắng màn

**Files:**
- Create: `Assets/Scripts/UI/HudPanel.cs`
- Create: `Assets/Scripts/UI/LevelCompletePanel.cs`
- Modify: `Assets/Scenes/Main.unity`

**Interfaces:**
- Consumes: `GameSession`, `GameFlowController`, `InputRouter`
- Produces:
  - `Sokoban.UI.HudPanel` — `void Show(); void Hide(); void Bind(GameSession session);`
  - `Sokoban.UI.LevelCompletePanel` — `void Show(int moves, int previousBest, bool isLastLevel); void Hide();`

- [ ] **Step 1: Dựng HUD trong Canvas**

`HudPanel`: hàng trên hiển thị tên màn bên trái, `Bước: 0` và `Đẩy: 0` bên phải. Hàng dưới là 4 nút
**Hoàn tác · Làm lại · Chơi lại · Thoát**, mỗi nút cao tối thiểu 88 px để bấm được bằng ngón tay.

`LevelCompletePanel`: nền mờ phủ toàn màn, một hộp giữa màn hình với chữ "Hoàn thành!", số bước lượt này,
dòng kỷ lục cũ, và ba nút **Màn tiếp · Chơi lại · Chọn màn**.

- [ ] **Step 2: Viết `HudPanel.cs`**

```csharp
using Sokoban.Core;
using Sokoban.View;
using TMPro;
using UnityEngine;
using UnityEngine.UI;

namespace Sokoban.UI
{
    public class HudPanel : MonoBehaviour
    {
        [SerializeField] GameFlowController flow;
        [SerializeField] LevelPlayer levelPlayer;
        [SerializeField] TextMeshProUGUI levelNameLabel;
        [SerializeField] TextMeshProUGUI movesLabel;
        [SerializeField] TextMeshProUGUI pushesLabel;
        [SerializeField] Button undoButton;
        [SerializeField] Button redoButton;
        [SerializeField] Button restartButton;
        [SerializeField] Button exitButton;

        GameSession _session;

        void Awake()
        {
            // Phải đi qua LevelPlayer, không gọi thẳng _session.TryUndo():
            // gọi thẳng sẽ đổi trạng thái logic mà bỏ qua animation và sổ tay vị trí hộp.
            undoButton.onClick.AddListener(() => levelPlayer.RequestUndo());
            redoButton.onClick.AddListener(() => levelPlayer.RequestRedo());
            restartButton.onClick.AddListener(() => levelPlayer.RequestRestart());
            exitButton.onClick.AddListener(() => flow.ShowLevelSelect());
        }

        public void Bind(GameSession session)
        {
            if (_session != null) _session.Changed -= Refresh;

            _session = session;
            if (_session != null) _session.Changed += Refresh;

            Refresh();
        }

        void Refresh()
        {
            if (_session == null) return;

            levelNameLabel.text = $"Màn {_session.LevelName}";
            movesLabel.text = $"Bước: {_session.Moves}";
            pushesLabel.text = $"Đẩy: {_session.Pushes}";
            undoButton.interactable = _session.CanUndo;
            redoButton.interactable = _session.CanRedo;
        }

        public void Show() => gameObject.SetActive(true);

        public void Hide()
        {
            if (_session != null) _session.Changed -= Refresh;
            gameObject.SetActive(false);
        }
    }
}
```

- [ ] **Step 3: Viết `LevelCompletePanel.cs`**

```csharp
using TMPro;
using UnityEngine;
using UnityEngine.UI;

namespace Sokoban.UI
{
    public class LevelCompletePanel : MonoBehaviour
    {
        [SerializeField] GameFlowController flow;
        [SerializeField] TextMeshProUGUI titleLabel;
        [SerializeField] TextMeshProUGUI movesLabel;
        [SerializeField] TextMeshProUGUI bestLabel;
        [SerializeField] Button nextButton;
        [SerializeField] Button replayButton;
        [SerializeField] Button selectButton;

        void Awake()
        {
            nextButton.onClick.AddListener(() => flow.NextLevel());
            replayButton.onClick.AddListener(() => flow.ReplayLevel());
            selectButton.onClick.AddListener(() => flow.ShowLevelSelect());
        }

        public void Show(int moves, int previousBest, bool isLastLevel)
        {
            gameObject.SetActive(true);

            titleLabel.text = isLastLevel ? "Xong cả bộ màn!" : "Hoàn thành!";
            movesLabel.text = $"{moves} bước";
            bestLabel.text = previousBest > 0 ? $"Kỷ lục cũ: {previousBest} bước" : "Kỷ lục đầu tiên";

            // Ở màn cuối không còn màn nào để đi tiếp.
            nextButton.gameObject.SetActive(!isLastLevel);
        }

        public void Hide() => gameObject.SetActive(false);
    }
}
```

- [ ] **Step 4: Nối hai panel vào `GameFlowController`**

Task 10 cố tình để `GameFlowController` chưa biết tới HUD và panel thắng, vì hai type đó chưa tồn tại.
Giờ bổ sung. Thêm hai trường:

```csharp
        [SerializeField] HudPanel hud;
        [SerializeField] LevelCompletePanel levelComplete;
```

Thêm `hud.Hide(); levelComplete.Hide();` vào cả `ShowMainMenu()` và `ShowLevelSelect()`.

Trong `StartLevel`, sau `levelPlayer.LoadLevel(...)` thêm:

```csharp
            levelComplete.Hide();
            hud.Show();
            hud.Bind(levelPlayer.Session);
```

Và thay `OnSolved` tạm thời của Task 10 bằng bản thật:

```csharp
        void OnSolved()
        {
            var session = levelPlayer.Session;

            // Đọc kỷ lục cũ TRƯỚC khi ghi kết quả lượt này, nếu không sẽ luôn hiện kỷ lục vừa lập.
            var previous = ProgressStore.GetRecord(collection.collectionName, _currentIndex);
            int oldBest = previous.completed ? previous.bestMoves : 0;

            ProgressStore.RecordCompletion(collection.collectionName, _currentIndex,
                                           session.Moves, session.Pushes);

            bool isLast = _currentIndex >= collection.levels.Count - 1;
            levelComplete.Show(session.Moves, oldBest, isLast);
        }
```

- [ ] **Step 5: Chơi thử toàn luồng**

Bấm Play, chơi hết màn 1: HUD phải đếm đúng bước và đẩy, nút Hoàn tác mờ khi chưa có nước nào,
panel thắng hiện đúng số bước và dòng "Kỷ lục đầu tiên". Chơi lại màn 1 với số bước nhiều hơn —
panel phải hiện kỷ lục cũ (số nhỏ hơn), và kỷ lục lưu lại không được xấu đi.
Chơi tới màn cuối để xác nhận nút **Màn tiếp** bị ẩn.

- [ ] **Step 6: Commit**

```bash
cd /d/Hung/Sokoban
git add Assets/Scripts/UI Assets/Scenes/Main.unity
git commit -m "Add in-level HUD and level complete panel"
```

---

## Task 12: Âm thanh

**Files:**
- Create: `Assets/Scripts/Audio/AudioService.cs`
- Create: `Assets/Audio/` (5 SFX + 1 nhạc nền)
- Modify: `Assets/Scripts/View/LevelPlayer.cs`, `Assets/Scenes/Main.unity`

**Interfaces:**
- Consumes: `ProgressStore.Muted`
- Produces:
  - `Sokoban.Audio.AudioService` — `static AudioService Instance;`
    `void PlayStep(); void PlayPush(); void PlayBoxOnGoal(); void PlayWin(); void PlayUndo();`
    `void SetMuted(bool muted); void StartMusicOnFirstInteraction();`

- [ ] **Step 1: Chuẩn bị file âm thanh CC0**

Cần 6 file trong `Assets/Audio/`: `step.wav`, `push.wav`, `box_on_goal.wav`, `win.wav`, `undo.wav`,
`music_loop.ogg`. Nguồn CC0 gợi ý: kenney.nl/assets (bộ "UI Audio", "Impact Sounds") hoặc freesound.org
lọc theo giấy phép CC0.

Nếu không tải được nguồn CC0 phù hợp, **dừng và hỏi người dùng** — không nhúng âm thanh không rõ giấy phép.

- [ ] **Step 2: Viết `AudioService.cs`**

```csharp
using UnityEngine;

namespace Sokoban.Audio
{
    public class AudioService : MonoBehaviour
    {
        public static AudioService Instance { get; private set; }

        [SerializeField] AudioSource sfxSource;
        [SerializeField] AudioSource musicSource;
        [SerializeField] AudioClip step;
        [SerializeField] AudioClip push;
        [SerializeField] AudioClip boxOnGoal;
        [SerializeField] AudioClip win;
        [SerializeField] AudioClip undo;

        bool _musicStarted;

        void Awake()
        {
            if (Instance != null && Instance != this) { Destroy(gameObject); return; }
            Instance = this;
        }

        public void PlayStep() => Play(step);
        public void PlayPush() => Play(push);
        public void PlayBoxOnGoal() => Play(boxOnGoal);
        public void PlayWin() => Play(win);
        public void PlayUndo() => Play(undo);

        void Play(AudioClip clip)
        {
            if (clip == null || sfxSource == null) return;
            sfxSource.PlayOneShot(clip);
        }

        public void SetMuted(bool muted)
        {
            AudioListener.volume = muted ? 0f : 1f;
        }

        /// <summary>Trình duyệt chặn audio trước thao tác đầu tiên, nên nhạc chỉ bật từ lần bấm đầu.</summary>
        public void StartMusicOnFirstInteraction()
        {
            if (_musicStarted || musicSource == null) return;

            _musicStarted = true;
            musicSource.loop = true;
            musicSource.Play();
        }
    }
}
```

- [ ] **Step 3: Nối tiếng vào các sự kiện**

Trong `LevelPlayer.OnMoved`, ngay sau khi nước đi được chấp nhận:

```csharp
            var audio = AudioService.Instance;
            if (audio != null)
            {
                if (move.IsPush) audio.PlayPush();
                else audio.PlayStep();
            }
```

Và trong callback `onComplete` của `OnMoved`, sau khi đã đổi sprite hộp:

```csharp
                if (move.IsPush && Session.Board.GetCell(move.BoxTo) == CellType.Goal)
                    AudioService.Instance?.PlayBoxOnGoal();

                if (Session.IsSolved) AudioService.Instance?.PlayWin();
```

Trong `OnUndo` và `OnRedo`, sau khi pop thành công: `AudioService.Instance?.PlayUndo();`

Trong `GameFlowController.Start`, áp trạng thái tắt tiếng đã lưu:

```csharp
            AudioService.Instance?.SetMuted(ProgressStore.Muted);
```

Nhạc nền chỉ được bật sau thao tác đầu tiên của người dùng, nên gọi trong `StartLevel` và trong
`MainMenuPanel` mỗi khi bấm nút:

```csharp
            AudioService.Instance?.StartMusicOnFirstInteraction();
```

Cuối cùng, `MainMenuPanel.ToggleMute` gọi thêm `AudioService.Instance?.SetMuted(ProgressStore.Muted);`
sau khi đảo giá trị, để tiếng tắt ngay chứ không đợi lần khởi động sau.

- [ ] **Step 4: Nghe thử**

Bấm Play, đi vài bước, đẩy hộp vào đích, undo, thắng màn — mỗi hành động phải có tiếng riêng.
Bật Tắt tiếng rồi Play lại: phải im, và trạng thái tắt tiếng còn giữ sau khi Stop rồi Play lại.

- [ ] **Step 5: Commit**

```bash
cd /d/Hung/Sokoban
git add Assets/Scripts/Audio Assets/Audio Assets/Scripts/View Assets/Scenes/Main.unity
git commit -m "Add sound effects, looping music and mute toggle"
```

---

## Task 13: Level editor cho dev

**Files:**
- Create: `Assets/Scripts/Levels/LevelValidator.cs`
- Create: `Assets/Editor/LevelCollectionWindow.cs`
- Test: `Assets/Tests/EditMode/LevelValidatorTests.cs`

**Interfaces:**
- Consumes: `LevelData`, `LevelCollection`, `SokobanChars`, `MicrobanParser`
- Produces:
  - `Sokoban.Levels.ValidationIssue` — `string Message;`
  - `Sokoban.Levels.LevelValidator.Validate(LevelData) → List<ValidationIssue>` (rỗng = hợp lệ)
  - EditorWindow mở bằng menu `Sokoban/Level Collection Editor`

- [ ] **Step 1: Viết test thất bại cho validator**

`Assets/Tests/EditMode/LevelValidatorTests.cs`:

```csharp
using NUnit.Framework;
using Sokoban.Levels;

namespace Sokoban.Tests
{
    public class LevelValidatorTests
    {
        [Test]
        public void ValidLevel_HasNoIssues()
        {
            var issues = LevelValidator.Validate(BoardTests.Level(
                "#####",
                "#@$.#",
                "#####"));

            Assert.AreEqual(0, issues.Count, string.Join("; ", issues.ConvertAll(i => i.Message)));
        }

        [Test]
        public void NoPlayer_IsReported()
        {
            var issues = LevelValidator.Validate(BoardTests.Level(
                "#####",
                "# $.#",
                "#####"));

            Assert.AreEqual(1, issues.Count);
            StringAssert.Contains("người chơi", issues[0].Message);
        }

        [Test]
        public void TwoPlayers_AreReported()
        {
            var issues = LevelValidator.Validate(BoardTests.Level(
                "######",
                "#@$.@#",
                "######"));

            StringAssert.Contains("người chơi", issues[0].Message);
        }

        [Test]
        public void BoxGoalMismatch_IsReported()
        {
            var issues = LevelValidator.Validate(BoardTests.Level(
                "######",
                "#@$$.#",
                "######"));

            Assert.AreEqual(1, issues.Count);
            StringAssert.Contains("hộp", issues[0].Message);
        }

        [Test]
        public void OpenBoundary_IsReported()
        {
            // Thiếu tường bên phải nên người chơi đi ra ngoài lưới được.
            var issues = LevelValidator.Validate(BoardTests.Level(
                "#####",
                "#@$. ",
                "#####"));

            Assert.AreEqual(1, issues.Count);
            StringAssert.Contains("kín", issues[0].Message);
        }

        [Test]
        public void NoBoxes_IsReported()
        {
            var issues = LevelValidator.Validate(BoardTests.Level(
                "#####",
                "#@  #",
                "#####"));

            StringAssert.Contains("hộp", issues[0].Message);
        }
    }
}
```

- [ ] **Step 2: Chạy test, xác nhận thất bại**

`run_tests` mode EditMode. Kỳ vọng: FAIL — chưa có `LevelValidator`.

- [ ] **Step 3: Viết `LevelValidator.cs`**

```csharp
using System.Collections.Generic;
using UnityEngine;

namespace Sokoban.Levels
{
    public class ValidationIssue
    {
        public string Message;
        public ValidationIssue(string message) => Message = message;
    }

    /// <summary>Kiểm tra cấu trúc một màn. Không kiểm tra màn có giải được hay không.</summary>
    public static class LevelValidator
    {
        public static List<ValidationIssue> Validate(LevelData level)
        {
            var issues = new List<ValidationIssue>();
            if (level == null || level.rows == null || level.rows.Length == 0)
            {
                issues.Add(new ValidationIssue("Màn rỗng"));
                return issues;
            }

            int players = 0, boxes = 0, goals = 0;
            Vector2Int playerPos = default;

            for (int y = 0; y < level.rows.Length; y++)
            {
                string row = level.rows[y];
                for (int x = 0; x < row.Length; x++)
                {
                    char c = row[x];
                    if (c == SokobanChars.Player || c == SokobanChars.PlayerOnGoal)
                    {
                        players++;
                        playerPos = new Vector2Int(x, y);
                    }
                    if (c == SokobanChars.Box || c == SokobanChars.BoxOnGoal) boxes++;
                    if (c == SokobanChars.Goal || c == SokobanChars.BoxOnGoal ||
                        c == SokobanChars.PlayerOnGoal) goals++;
                }
            }

            if (players != 1)
                issues.Add(new ValidationIssue($"Phải có đúng một người chơi, đang có {players}"));
            if (boxes == 0)
                issues.Add(new ValidationIssue("Màn không có hộp nào"));
            else if (boxes != goals)
                issues.Add(new ValidationIssue($"Số hộp ({boxes}) khác số đích ({goals})"));

            if (players == 1 && !IsEnclosed(level, playerPos))
                issues.Add(new ValidationIssue("Vùng chơi chưa kín — người chơi đi ra ngoài lưới được"));

            return issues;
        }

        static bool IsEnclosed(LevelData level, Vector2Int start)
        {
            int height = level.rows.Length;
            var seen = new HashSet<Vector2Int> { start };
            var queue = new Queue<Vector2Int>();
            queue.Enqueue(start);

            var deltas = new[]
            {
                new Vector2Int(1, 0), new Vector2Int(-1, 0),
                new Vector2Int(0, 1), new Vector2Int(0, -1)
            };

            while (queue.Count > 0)
            {
                var p = queue.Dequeue();
                foreach (var d in deltas)
                {
                    var n = p + d;
                    if (n.y < 0 || n.y >= height) return false;

                    string row = level.rows[n.y];
                    if (n.x < 0 || n.x >= row.Length) return false;

                    if (row[n.x] == SokobanChars.Wall || seen.Contains(n)) continue;
                    seen.Add(n);
                    queue.Enqueue(n);
                }
            }

            return true;
        }
    }
}
```

- [ ] **Step 4: Chạy test, xác nhận tất cả PASS**

`run_tests` mode EditMode. Kỳ vọng: 6/6 `LevelValidatorTests` PASS, và toàn bộ test cũ vẫn xanh.

- [ ] **Step 5: Viết `LevelCollectionWindow.cs`**

```csharp
using System.Collections.Generic;
using System.IO;
using Sokoban.Levels;
using UnityEditor;
using UnityEngine;

namespace Sokoban.EditorTools
{
    /// <summary>Vẽ và sửa màn trong một LevelCollection bằng bảng cọ.</summary>
    public class LevelCollectionWindow : EditorWindow
    {
        enum Brush { Wall, Floor, Goal, Box, Player, Erase }

        LevelCollection _collection;
        int _levelIndex;
        Brush _brush = Brush.Wall;
        Vector2 _listScroll, _gridScroll;
        List<ValidationIssue> _issues = new List<ValidationIssue>();

        const float CellSize = 22f;

        [MenuItem("Sokoban/Level Collection Editor")]
        public static void Open() => GetWindow<LevelCollectionWindow>("Sokoban Levels");

        void OnGUI()
        {
            _collection = (LevelCollection)EditorGUILayout.ObjectField(
                "Collection", _collection, typeof(LevelCollection), false);

            if (_collection == null)
            {
                EditorGUILayout.HelpBox("Chọn một LevelCollection để bắt đầu.", MessageType.Info);
                return;
            }

            DrawToolbar();

            EditorGUILayout.BeginHorizontal();
            DrawLevelList();
            DrawGrid();
            EditorGUILayout.EndHorizontal();

            DrawIssues();
        }

        void DrawToolbar()
        {
            EditorGUILayout.BeginHorizontal(EditorStyles.toolbar);

            if (GUILayout.Button("Thêm màn", EditorStyles.toolbarButton)) AddLevel();
            if (GUILayout.Button("Xoá màn", EditorStyles.toolbarButton)) RemoveLevel();
            if (GUILayout.Button("Lên", EditorStyles.toolbarButton)) MoveLevel(-1);
            if (GUILayout.Button("Xuống", EditorStyles.toolbarButton)) MoveLevel(1);

            GUILayout.FlexibleSpace();

            if (GUILayout.Button("Kiểm tra", EditorStyles.toolbarButton)) Validate();
            if (GUILayout.Button("Import .txt", EditorStyles.toolbarButton)) ImportText();

            EditorGUILayout.EndHorizontal();

            _brush = (Brush)GUILayout.Toolbar((int)_brush,
                new[] { "Tường", "Nền", "Đích", "Hộp", "Người", "Xoá" });
        }

        void DrawLevelList()
        {
            _listScroll = EditorGUILayout.BeginScrollView(_listScroll, GUILayout.Width(170));
            for (int i = 0; i < _collection.levels.Count; i++)
            {
                bool selected = i == _levelIndex;
                if (GUILayout.Toggle(selected, $"{i + 1}. {_collection.levels[i].name}", "Button") && !selected)
                {
                    _levelIndex = i;
                    _issues.Clear();
                }
            }
            EditorGUILayout.EndScrollView();
        }

        void DrawGrid()
        {
            if (_collection.levels.Count == 0) { EditorGUILayout.LabelField("Chưa có màn nào"); return; }

            _levelIndex = Mathf.Clamp(_levelIndex, 0, _collection.levels.Count - 1);
            var level = _collection.levels[_levelIndex];

            EditorGUILayout.BeginVertical();
            level.name = EditorGUILayout.TextField("Tên", level.name);

            int newWidth = EditorGUILayout.IntSlider("Rộng", level.width, 3, 40);
            int newHeight = EditorGUILayout.IntSlider("Cao", level.height, 3, 30);
            if (newWidth != level.width || newHeight != level.height) Resize(level, newWidth, newHeight);

            _gridScroll = EditorGUILayout.BeginScrollView(_gridScroll);
            var origin = GUILayoutUtility.GetRect(level.width * CellSize, level.height * CellSize);

            for (int y = 0; y < level.height; y++)
            {
                for (int x = 0; x < level.width; x++)
                {
                    var rect = new Rect(origin.x + x * CellSize, origin.y + y * CellSize, CellSize - 1, CellSize - 1);
                    char c = level.rows[y][x];

                    EditorGUI.DrawRect(rect, ColorFor(c));
                    if (c != SokobanChars.Floor && c != SokobanChars.Wall)
                        GUI.Label(rect, c.ToString());

                    if (Event.current.type == EventType.MouseDown && rect.Contains(Event.current.mousePosition))
                    {
                        Paint(level, x, y);
                        Event.current.Use();
                    }
                }
            }

            EditorGUILayout.EndScrollView();
            EditorGUILayout.EndVertical();
        }

        static Color ColorFor(char c) => c switch
        {
            SokobanChars.Wall => new Color(0.30f, 0.30f, 0.34f),
            SokobanChars.Goal => new Color(0.60f, 0.25f, 0.25f),
            SokobanChars.Box => new Color(0.70f, 0.55f, 0.30f),
            SokobanChars.BoxOnGoal => new Color(0.50f, 0.40f, 0.20f),
            SokobanChars.Player => new Color(0.25f, 0.55f, 0.35f),
            SokobanChars.PlayerOnGoal => new Color(0.20f, 0.45f, 0.30f),
            _ => new Color(0.85f, 0.82f, 0.78f)
        };

        void Paint(LevelData level, int x, int y)
        {
            char existing = level.rows[y][x];
            bool onGoal = existing == SokobanChars.Goal || existing == SokobanChars.BoxOnGoal ||
                          existing == SokobanChars.PlayerOnGoal;

            char next = _brush switch
            {
                Brush.Wall => SokobanChars.Wall,
                Brush.Floor => SokobanChars.Floor,
                Brush.Goal => SokobanChars.Goal,
                Brush.Box => onGoal ? SokobanChars.BoxOnGoal : SokobanChars.Box,
                Brush.Player => onGoal ? SokobanChars.PlayerOnGoal : SokobanChars.Player,
                _ => SokobanChars.Floor
            };

            // Chỉ được có một người chơi: đặt chỗ mới thì xoá chỗ cũ.
            if (next == SokobanChars.Player || next == SokobanChars.PlayerOnGoal)
                ClearExistingPlayer(level);

            SetChar(level, x, y, next);
            EditorUtility.SetDirty(_collection);
            Repaint();
        }

        static void ClearExistingPlayer(LevelData level)
        {
            for (int y = 0; y < level.height; y++)
                for (int x = 0; x < level.width; x++)
                {
                    char c = level.rows[y][x];
                    if (c == SokobanChars.Player) SetChar(level, x, y, SokobanChars.Floor);
                    else if (c == SokobanChars.PlayerOnGoal) SetChar(level, x, y, SokobanChars.Goal);
                }
        }

        static void SetChar(LevelData level, int x, int y, char c)
        {
            var chars = level.rows[y].ToCharArray();
            chars[x] = c;
            level.rows[y] = new string(chars);
        }

        static void Resize(LevelData level, int width, int height)
        {
            var rows = new string[height];
            for (int y = 0; y < height; y++)
            {
                string old = y < level.rows.Length ? level.rows[y] : "";
                rows[y] = old.Length >= width ? old.Substring(0, width) : old.PadRight(width);
            }
            level.rows = rows;
            level.width = width;
            level.height = height;
        }

        void AddLevel()
        {
            const int w = 9, h = 7;
            var rows = new string[h];
            for (int y = 0; y < h; y++)
                rows[y] = y == 0 || y == h - 1
                    ? new string(SokobanChars.Wall, w)
                    : SokobanChars.Wall + new string(SokobanChars.Floor, w - 2) + SokobanChars.Wall;

            _collection.levels.Add(new LevelData
            {
                name = $"Level {_collection.levels.Count + 1}",
                width = w,
                height = h,
                rows = rows
            });
            _levelIndex = _collection.levels.Count - 1;
            EditorUtility.SetDirty(_collection);
        }

        void RemoveLevel()
        {
            if (_collection.levels.Count == 0) return;
            _collection.levels.RemoveAt(_levelIndex);
            _levelIndex = Mathf.Max(0, _levelIndex - 1);
            EditorUtility.SetDirty(_collection);
        }

        void MoveLevel(int offset)
        {
            int target = _levelIndex + offset;
            if (target < 0 || target >= _collection.levels.Count) return;

            var tmp = _collection.levels[_levelIndex];
            _collection.levels[_levelIndex] = _collection.levels[target];
            _collection.levels[target] = tmp;
            _levelIndex = target;
            EditorUtility.SetDirty(_collection);
        }

        void Validate()
        {
            if (_collection.levels.Count == 0) return;
            _issues = LevelValidator.Validate(_collection.levels[_levelIndex]);
        }

        void ImportText()
        {
            string path = EditorUtility.OpenFilePanel("Chọn file màn", "Assets", "txt");
            if (string.IsNullOrEmpty(path)) return;

            int count = MicrobanImporter.ImportTextIntoCollection(File.ReadAllText(path), _collection);
            EditorUtility.SetDirty(_collection);
            AssetDatabase.SaveAssets();
            Debug.Log($"LevelCollectionWindow: nạp {count} màn");
        }

        void DrawIssues()
        {
            if (_issues.Count == 0) return;

            foreach (var issue in _issues)
                EditorGUILayout.HelpBox(issue.Message, MessageType.Error);
        }
    }
}
```

- [ ] **Step 6: Thử tay trong Editor**

Mở **Sokoban → Level Collection Editor**, chọn `Microban.asset`.
Kỳ vọng: danh sách 155 màn; chọn màn 1 thấy lưới đúng; bấm **Kiểm tra** không ra lỗi nào.
Bấm **Thêm màn** → vẽ thử → **Kiểm tra** phải báo thiếu người chơi và thiếu hộp.
Đặt người chơi ở hai chỗ khác nhau — chỗ cũ phải tự biến mất.

**Quan trọng:** sau khi thử xong, hoàn tác các thay đổi lên `Microban.asset`
(`git checkout -- Assets/Levels/Microban.asset`) để asset giữ đúng 155 màn gốc.

- [ ] **Step 7: Commit**

```bash
cd /d/Hung/Sokoban
git add Assets/Scripts/Levels/LevelValidator.cs Assets/Editor/LevelCollectionWindow.cs Assets/Tests/EditMode/LevelValidatorTests.cs
git commit -m "Add level validator and dev level editor window"
```

---

## Task 14: Build WebGL

**Files:**
- Modify: `ProjectSettings/ProjectSettings.asset` (tên game, icon, cài đặt WebGL)
- Create: `Build/WebGL/` (kết quả build, **không** commit)
- Modify: `.gitignore`

**Interfaces:**
- Consumes: toàn bộ các task trước
- Produces: thư mục build WebGL chạy được

- [ ] **Step 1: Đặt Player Settings**

**File → Build Settings → WebGL → Switch Platform** (lần đầu import lại asset sẽ lâu).

Trong Player Settings:
- Company Name / Product Name: đặt `Sokoban`.
- Resolution: Default Canvas Width `1920`, Height `1080`, Run In Background bật.
- Publishing Settings: Compression Format = **Gzip**, Decompression Fallback = **bật**
  (không có nó thì nhiều cách host tĩnh sẽ trả về file nén mà trình duyệt không giải được).
- Other Settings: Color Space = **Gamma** (nhẹ hơn cho WebGL), Strip Engine Code bật.
- Splash Image: tắt "Show Splash Screen" nếu bản Unity cho phép.

- [ ] **Step 2: Chặn thư mục build khỏi git**

Thêm vào `.gitignore`:

```
/Build/
```

- [ ] **Step 3: Build**

**File → Build Settings → Build**, xuất ra `Build/WebGL`. Hoặc qua MCP `manage_build`
với `target: "webgl"`, `output_path: "Build/WebGL"`.

Kỳ vọng: build xong không lỗi. Lần đầu có thể mất 5–15 phút.

- [ ] **Step 4: Chạy thử bản build**

WebGL không chạy được qua `file://`, phải có server tĩnh:

```bash
cd /d/Hung/Sokoban/Build/WebGL
python -m http.server 8000
```

Mở `http://localhost:8000` (cổng 8000 để khỏi đụng 8080 của MCP).

Danh sách kiểm tra trên trình duyệt:
- Menu chính hiện ra, không lỗi đỏ trong console trình duyệt.
- Chọn màn hiện đủ 155 nút; chỉ màn 1 mở.
- Chơi xong màn 1 → panel thắng → màn 2 mở khoá.
- **Tải lại trang**: tiến độ vẫn còn (đây là phép thử thật cho PlayerPrefs trên IndexedDB).
- Bàn phím đi được; thu nhỏ cửa sổ xuống cỡ điện thoại và thử kéo chuột để kiểm tra nhánh vuốt.
- Có tiếng sau lần bấm đầu tiên; nút Tắt tiếng có tác dụng.

- [ ] **Step 5: Commit**

```bash
cd /d/Hung/Sokoban
git add .gitignore ProjectSettings/ProjectSettings.asset
git commit -m "Configure and verify the WebGL build"
```

---

## Kiểm tra cuối

Sau Task 14, chạy lại toàn bộ:

- [ ] `run_tests` mode EditMode — **tất cả** test xanh (parser, hồi quy 155 màn, board, luật đi, undo/redo, lời giải, tiến độ, validator).
- [ ] `read_console` — 0 lỗi, 0 cảnh báo.
- [ ] `git status` — cây làm việc sạch, không sót file cần commit.
- [ ] Chơi liền 3 màn đầu trên bản WebGL, tải lại trang giữa chừng để xác nhận tiến độ được nhớ.
