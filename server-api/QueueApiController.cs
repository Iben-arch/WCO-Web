using Microsoft.AspNetCore.Mvc;
using System.Collections.Concurrent;
using System.ComponentModel.DataAnnotations;

namespace ServerApi.Controllers
{
    /// <summary>
    /// API Controller ที่ทำหน้าที่เป็น Queue/Middleware สำหรับจัดการ Create และ Edit operations
    /// </summary>
    [ApiController]
    [Route("api/[controller]")]
    public class QueueApiController : ControllerBase
    {
        // In-memory queue สำหรับเก็บ request ที่รอการประมวลผล
        private static readonly ConcurrentQueue<QueueItem> _requestQueue = new();
        private static readonly ConcurrentDictionary<string, QueueItem> _processingItems = new();
        private static readonly object _lockObject = new();

        /// <summary>
        /// สร้างข้อมูลใหม่ผ่าน Queue
        /// </summary>
        /// <param name="request">ข้อมูลที่ต้องการสร้าง</param>
        /// <returns>Response พร้อม Queue ID</returns>
        [HttpPost("create")]
        public async Task<IActionResult> Create([FromBody] CreateRequest request)
        {
            if (!ModelState.IsValid)
            {
                return BadRequest(ModelState);
            }

            var queueItem = new QueueItem
            {
                Id = Guid.NewGuid().ToString(),
                Operation = "CREATE",
                EntityType = request.EntityType,
                Data = request.Data,
                Status = "PENDING",
                CreatedAt = DateTime.UtcNow
            };

            _requestQueue.Enqueue(queueItem);

            // เริ่มประมวลผลแบบ async
            _ = Task.Run(async () => await ProcessQueueItem(queueItem));

            return Ok(new
            {
                success = true,
                message = "Request ถูกเพิ่มเข้า Queue แล้ว",
                queueId = queueItem.Id,
                status = queueItem.Status
            });
        }

        /// <summary>
        /// แก้ไขข้อมูลผ่าน Queue
        /// </summary>
        /// <param name="id">ID ของข้อมูลที่ต้องการแก้ไข</param>
        /// <param name="request">ข้อมูลที่ต้องการแก้ไข</param>
        /// <returns>Response พร้อม Queue ID</returns>
        [HttpPut("edit/{id}")]
        public async Task<IActionResult> Edit(string id, [FromBody] EditRequest request)
        {
            if (!ModelState.IsValid)
            {
                return BadRequest(ModelState);
            }

            var queueItem = new QueueItem
            {
                Id = Guid.NewGuid().ToString(),
                Operation = "EDIT",
                EntityType = request.EntityType,
                EntityId = id,
                Data = request.Data,
                Status = "PENDING",
                CreatedAt = DateTime.UtcNow
            };

            _requestQueue.Enqueue(queueItem);

            // เริ่มประมวลผลแบบ async
            _ = Task.Run(async () => await ProcessQueueItem(queueItem));

            return Ok(new
            {
                success = true,
                message = "Request ถูกเพิ่มเข้า Queue แล้ว",
                queueId = queueItem.Id,
                status = queueItem.Status
            });
        }

        /// <summary>
        /// ตรวจสอบสถานะของ Queue Item
        /// </summary>
        /// <param name="queueId">Queue ID</param>
        /// <returns>สถานะปัจจุบัน</returns>
        [HttpGet("status/{queueId}")]
        public IActionResult GetStatus(string queueId)
        {
            var item = _processingItems.Values.FirstOrDefault(x => x.Id == queueId);
            
            if (item == null)
            {
                return NotFound(new
                {
                    success = false,
                    message = "ไม่พบ Queue Item ที่ระบุ"
                });
            }

            return Ok(new
            {
                success = true,
                queueId = item.Id,
                status = item.Status,
                operation = item.Operation,
                entityType = item.EntityType,
                entityId = item.EntityId,
                createdAt = item.CreatedAt,
                processedAt = item.ProcessedAt,
                error = item.Error
            });
        }

        /// <summary>
        /// ดู Queue ทั้งหมด (สำหรับ Admin/Debug)
        /// </summary>
        /// <returns>รายการ Queue Items</returns>
        [HttpGet("queue")]
        public IActionResult GetQueue()
        {
            var items = _processingItems.Values.OrderByDescending(x => x.CreatedAt).ToList();
            
            return Ok(new
            {
                success = true,
                count = items.Count,
                queueLength = _requestQueue.Count,
                items = items.Select(x => new
                {
                    queueId = x.Id,
                    status = x.Status,
                    operation = x.Operation,
                    entityType = x.EntityType,
                    entityId = x.EntityId,
                    createdAt = x.CreatedAt,
                    processedAt = x.ProcessedAt
                })
            });
        }

        /// <summary>
        /// ประมวลผล Queue Item
        /// </summary>
        private async Task ProcessQueueItem(QueueItem item)
        {
            try
            {
                item.Status = "PROCESSING";
                _processingItems.TryAdd(item.Id, item);

                // จำลองการประมวลผล (ใน production ควรเชื่อมต่อกับ database หรือ service อื่นๆ)
                await Task.Delay(1000); // จำลอง delay

                // ตัวอย่างการประมวลผลตาม EntityType
                switch (item.EntityType.ToUpper())
                {
                    case "POST":
                        await ProcessPostOperation(item);
                        break;
                    case "PROFILE":
                        await ProcessProfileOperation(item);
                        break;
                    case "CART":
                        await ProcessCartOperation(item);
                        break;
                    default:
                        await ProcessGenericOperation(item);
                        break;
                }

                item.Status = "COMPLETED";
                item.ProcessedAt = DateTime.UtcNow;
            }
            catch (Exception ex)
            {
                item.Status = "FAILED";
                item.Error = ex.Message;
                item.ProcessedAt = DateTime.UtcNow;
            }
        }

        /// <summary>
        /// ประมวลผล Post operations
        /// </summary>
        private async Task ProcessPostOperation(QueueItem item)
        {
            // TODO: เชื่อมต่อกับ database หรือ service สำหรับจัดการ Posts
            await Task.CompletedTask;
        }

        /// <summary>
        /// ประมวลผล Profile operations
        /// </summary>
        private async Task ProcessProfileOperation(QueueItem item)
        {
            // TODO: เชื่อมต่อกับ database หรือ service สำหรับจัดการ Profiles
            await Task.CompletedTask;
        }

        /// <summary>
        /// ประมวลผล Cart operations
        /// </summary>
        private async Task ProcessCartOperation(QueueItem item)
        {
            // TODO: เชื่อมต่อกับ database หรือ service สำหรับจัดการ Cart
            await Task.CompletedTask;
        }

        /// <summary>
        /// ประมวลผล Generic operations
        /// </summary>
        private async Task ProcessGenericOperation(QueueItem item)
        {
            // TODO: เชื่อมต่อกับ database หรือ service สำหรับจัดการข้อมูลทั่วไป
            await Task.CompletedTask;
        }
    }

    /// <summary>
    /// Model สำหรับ Create Request
    /// </summary>
    public class CreateRequest
    {
        [Required(ErrorMessage = "EntityType is required")]
        public string EntityType { get; set; } = string.Empty;

        [Required(ErrorMessage = "Data is required")]
        public object Data { get; set; } = new();
    }

    /// <summary>
    /// Model สำหรับ Edit Request
    /// </summary>
    public class EditRequest
    {
        [Required(ErrorMessage = "EntityType is required")]
        public string EntityType { get; set; } = string.Empty;

        [Required(ErrorMessage = "Data is required")]
        public object Data { get; set; } = new();
    }

    /// <summary>
    /// Model สำหรับ Queue Item
    /// </summary>
    public class QueueItem
    {
        public string Id { get; set; } = string.Empty;
        public string Operation { get; set; } = string.Empty; // CREATE, EDIT
        public string EntityType { get; set; } = string.Empty; // POST, PROFILE, CART, etc.
        public string? EntityId { get; set; }
        public object Data { get; set; } = new();
        public string Status { get; set; } = "PENDING"; // PENDING, PROCESSING, COMPLETED, FAILED
        public DateTime CreatedAt { get; set; }
        public DateTime? ProcessedAt { get; set; }
        public string? Error { get; set; }
    }
}


