/*
 Trustmate Database Schema - Fixed Order
 Date: 21/01/2026
*/

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ----------------------------
-- Table structure for users (FIRST - no dependencies)
-- ----------------------------
DROP TABLE IF EXISTS `users`;
CREATE TABLE `users`  (
  `user_id` int NOT NULL AUTO_INCREMENT,
  `username` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `email` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `phone` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL,
  `password` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `role` enum('buyer','seller','admin') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT 'buyer',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `status` enum('active','frozen') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT 'active',
  `failed_login_attempts` int NOT NULL DEFAULT 0,
  PRIMARY KEY (`user_id`) USING BTREE,
  UNIQUE INDEX `username`(`username` ASC) USING BTREE,
  UNIQUE INDEX `email`(`email` ASC) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 5 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci ROW_FORMAT = Dynamic;

-- Records of users
INSERT INTO `users` (`user_id`, `username`, `email`, `phone`, `password`, `role`, `created_at`, `status`, `failed_login_attempts`)
VALUES (1, 'admin', 'admin@trustmate.com', NULL, '$2b$10$OaZQA/ggtzGJJkBg06sUKOcrdcq4gtiOsXeDIAyoSK3Xfw8D32UJG', 'admin', '2026-01-20 23:56:28', 'active', 0);
INSERT INTO `users` (`user_id`, `username`, `email`, `phone`, `password`, `role`, `created_at`, `status`, `failed_login_attempts`)
VALUES (2, 'john_doe', 'john@example.com', '1234567890', '$2b$10$OaZQA/ggtzGJJkBg06sUKOcrdcq4gtiOsXeDIAyoSK3Xfw8D32UJG', 'buyer', '2026-01-20 23:57:08', 'active', 0);
INSERT INTO `users` (`user_id`, `username`, `email`, `phone`, `password`, `role`, `created_at`, `status`, `failed_login_attempts`)
VALUES (3, 'jane_smith', 'jane@example.com', '0987654321', '$2b$10$OaZQA/ggtzGJJkBg06sUKOcrdcq4gtiOsXeDIAyoSK3Xfw8D32UJG', 'seller', '2026-01-20 23:57:08', 'active', 0);
INSERT INTO `users` (`user_id`, `username`, `email`, `phone`, `password`, `role`, `created_at`, `status`, `failed_login_attempts`)
VALUES (4, 'bob_wilson', 'bob@example.com', '5551234567', '$2b$10$OaZQA/ggtzGJJkBg06sUKOcrdcq4gtiOsXeDIAyoSK3Xfw8D32UJG', 'seller', '2026-01-20 23:57:08', 'active', 0);

-- ----------------------------
-- Table structure for categories (SECOND - no dependencies)
-- ----------------------------
DROP TABLE IF EXISTS `categories`;
CREATE TABLE `categories`  (
  `category_id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL,
  `icon` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL,
  PRIMARY KEY (`category_id`) USING BTREE,
  UNIQUE INDEX `name`(`name` ASC) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 7 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci ROW_FORMAT = Dynamic;

-- Records of categories
INSERT INTO `categories` VALUES (1, 'Programming', 'Software development and coding services', NULL);
INSERT INTO `categories` VALUES (2, 'Cleaning', 'Home and office cleaning services', NULL);
INSERT INTO `categories` VALUES (3, 'Marketing', 'Digital marketing and advertising', NULL);
INSERT INTO `categories` VALUES (4, 'Data Analyze', 'Data analysis and visualization', NULL);
INSERT INTO `categories` VALUES (5, 'Video Editing', 'Video production and editing', NULL);
INSERT INTO `categories` VALUES (6, 'Translation', 'Language translation services', NULL);

-- ----------------------------
-- Table structure for sellers (THIRD - depends on users)
-- ----------------------------
DROP TABLE IF EXISTS `sellers`;
CREATE TABLE `sellers`  (
  `seller_id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `business_name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL,
  `description` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL,
  `verified` tinyint(1) NULL DEFAULT 0,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`seller_id`) USING BTREE,
  INDEX `user_id`(`user_id` ASC) USING BTREE,
  CONSTRAINT `sellers_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`) ON DELETE CASCADE ON UPDATE RESTRICT
) ENGINE = InnoDB AUTO_INCREMENT = 3 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci ROW_FORMAT = Dynamic;

-- Records of sellers
INSERT INTO `sellers` VALUES (1, 3, 'Jane\'s Cleaning Services', 'Professional cleaning services for homes and offices', 1, '2026-01-20 23:57:08');
INSERT INTO `sellers` VALUES (2, 4, 'Bob\'s Tech Solutions', 'Web development and programming services', 1, '2026-01-20 23:57:08');

-- ----------------------------
-- Table structure for services (FOURTH - depends on sellers and categories)
-- ----------------------------
DROP TABLE IF EXISTS `services`;
CREATE TABLE `services`  (
  `service_id` int NOT NULL AUTO_INCREMENT,
  `seller_id` int NOT NULL,
  `title` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL,
  `price` decimal(10, 2) NOT NULL,
  `category_id` int NULL DEFAULT NULL,
  `image` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL,
  `status` enum('active','inactive') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT 'active',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`service_id`) USING BTREE,
  INDEX `seller_id`(`seller_id` ASC) USING BTREE,
  INDEX `category_id`(`category_id` ASC) USING BTREE,
  CONSTRAINT `services_ibfk_1` FOREIGN KEY (`seller_id`) REFERENCES `sellers` (`seller_id`) ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT `services_ibfk_2` FOREIGN KEY (`category_id`) REFERENCES `categories` (`category_id`) ON DELETE SET NULL ON UPDATE RESTRICT
) ENGINE = InnoDB AUTO_INCREMENT = 9 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci ROW_FORMAT = Dynamic;

-- Records of services
INSERT INTO `services` VALUES (1, 1, 'Home Cleaning Service', 'Professional home cleaning service. We clean your house from top to bottom.', 50.00, 2, '/images/default-service.png', 'active', '2026-01-20 23:57:08');
INSERT INTO `services` VALUES (2, 1, 'Office Cleaning', 'Keep your office spotless with our professional cleaning team.', 75.00, 2, '/images/default-service.png', 'active', '2026-01-20 23:57:08');
INSERT INTO `services` VALUES (3, 2, 'Website Development', 'Custom website development using modern technologies.', 500.00, 1, '/images/default-service.png', 'active', '2026-01-20 23:57:08');
INSERT INTO `services` VALUES (4, 2, 'Mobile App Development', 'iOS and Android app development services.', 1000.00, 1, '/images/default-service.png', 'active', '2026-01-20 23:57:08');
INSERT INTO `services` VALUES (5, 1, 'Deep Cleaning', 'Thorough deep cleaning service for your entire home.', 120.00, 2, '/images/default-service.png', 'active', '2026-01-20 23:57:08');
INSERT INTO `services` VALUES (6, 2, 'Logo Design', 'Professional logo design for your business.', 150.00, 3, '/images/default-service.png', 'active', '2026-01-20 23:57:08');
INSERT INTO `services` VALUES (7, 2, 'Data Analysis', 'Comprehensive data analysis and visualization services.', 300.00, 4, '/images/default-service.png', 'active', '2026-01-20 23:57:08');
INSERT INTO `services` VALUES (8, 1, 'Pet Sitting', "Reliable pet sitting services while you\'re away.", 30.00, 2, '/images/default-service.png', 'active', '2026-01-20 23:57:08');

-- ----------------------------
-- Table structure for cart (FIFTH - depends on users and services)
-- ----------------------------
DROP TABLE IF EXISTS `cart`;
CREATE TABLE `cart`  (
  `cart_id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `service_id` int NOT NULL,
  `quantity` int NULL DEFAULT 1,
  `added_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`cart_id`) USING BTREE,
  INDEX `user_id`(`user_id` ASC) USING BTREE,
  INDEX `service_id`(`service_id` ASC) USING BTREE,
  CONSTRAINT `cart_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`) ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT `cart_ibfk_2` FOREIGN KEY (`service_id`) REFERENCES `services` (`service_id`) ON DELETE CASCADE ON UPDATE RESTRICT
) ENGINE = InnoDB AUTO_INCREMENT = 3 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci ROW_FORMAT = Dynamic;

-- ----------------------------
-- Table structure for orders (SIXTH - depends on users)
-- ----------------------------
DROP TABLE IF EXISTS `orders`;
CREATE TABLE `orders`  (
  `order_id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `total_amount` decimal(10, 2) NOT NULL,
  `status` enum('pending','accepted','completed','cancelled') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT 'pending',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`order_id`) USING BTREE,
  INDEX `user_id`(`user_id` ASC) USING BTREE,
  CONSTRAINT `orders_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`) ON DELETE CASCADE ON UPDATE RESTRICT
) ENGINE = InnoDB AUTO_INCREMENT = 5 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci ROW_FORMAT = Dynamic;

-- Records of orders
INSERT INTO `orders` VALUES (1, 2, 50.00, 'completed', '2026-01-20 23:57:08');
INSERT INTO `orders` VALUES (2, 2, 500.00, 'pending', '2026-01-20 23:57:08');
INSERT INTO `orders` VALUES (3, 1, 225.00, 'pending', '2026-01-21 00:33:19');
INSERT INTO `orders` VALUES (4, 1, 75.00, 'completed', '2026-01-21 00:38:10');

-- ----------------------------
-- Table structure for payments (SEVENTH - depends on orders and users)
-- ----------------------------
DROP TABLE IF EXISTS `payments`;
CREATE TABLE `payments`  (
  `payment_id` int NOT NULL AUTO_INCREMENT,
  `order_id` int NOT NULL,
  `user_id` int NOT NULL,
  `provider` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `amount` decimal(10, 2) NOT NULL,
  `currency` char(3) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'SGD',
  `status` enum('unpaid','pending','paid','failed','refunded') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'unpaid',
  `escrow_status` enum('none','held','released','refunded') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'none',
  `payment_reference` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL,
  `provider_txn_id` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL,
  `refund_reason` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL,
  `refunded_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`payment_id`) USING BTREE,
  UNIQUE INDEX `uniq_payments_order_id`(`order_id` ASC) USING BTREE,
  INDEX `idx_payments_user_id`(`user_id` ASC) USING BTREE,
  INDEX `idx_payments_reference`(`payment_reference` ASC) USING BTREE,
  CONSTRAINT `payments_ibfk_order` FOREIGN KEY (`order_id`) REFERENCES `orders` (`order_id`) ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT `payments_ibfk_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`) ON DELETE CASCADE ON UPDATE RESTRICT
) ENGINE = InnoDB AUTO_INCREMENT = 5 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci ROW_FORMAT = Dynamic;

-- Records of payments
INSERT INTO `payments` VALUES (1, 1, 2, 'nets', 50.00, 'SGD', 'paid', 'released', NULL, NULL, NULL, NULL, '2026-01-20 23:57:08', '2026-01-20 23:57:08');
INSERT INTO `payments` VALUES (2, 2, 2, 'nets', 500.00, 'SGD', 'pending', 'none', NULL, NULL, NULL, NULL, '2026-01-20 23:57:08', '2026-01-20 23:57:08');
INSERT INTO `payments` VALUES (3, 3, 1, 'nets', 225.00, 'SGD', 'pending', 'none', NULL, NULL, NULL, NULL, '2026-01-21 00:33:19', '2026-01-21 00:33:19');
INSERT INTO `payments` VALUES (4, 4, 1, 'nets', 75.00, 'SGD', 'paid', 'released', NULL, NULL, NULL, NULL, '2026-01-21 00:38:10', '2026-01-21 00:38:10');

-- ----------------------------
-- Table structure for order_items (EIGHTH - depends on orders and services)
-- ----------------------------
DROP TABLE IF EXISTS `order_items`;
CREATE TABLE `order_items`  (
  `order_item_id` int NOT NULL AUTO_INCREMENT,
  `order_id` int NOT NULL,
  `service_id` int NOT NULL,
  `quantity` int NOT NULL,
  `price` decimal(10, 2) NOT NULL,
  PRIMARY KEY (`order_item_id`) USING BTREE,
  INDEX `order_id`(`order_id` ASC) USING BTREE,
  INDEX `service_id`(`service_id` ASC) USING BTREE,
  CONSTRAINT `order_items_ibfk_1` FOREIGN KEY (`order_id`) REFERENCES `orders` (`order_id`) ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT `order_items_ibfk_2` FOREIGN KEY (`service_id`) REFERENCES `services` (`service_id`) ON DELETE CASCADE ON UPDATE RESTRICT
) ENGINE = InnoDB AUTO_INCREMENT = 5 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci ROW_FORMAT = Dynamic;

-- Records of order_items
INSERT INTO `order_items` VALUES (1, 1, 1, 1, 50.00);
INSERT INTO `order_items` VALUES (2, 2, 3, 1, 500.00);
INSERT INTO `order_items` VALUES (3, 3, 2, 3, 75.00);
INSERT INTO `order_items` VALUES (4, 4, 2, 1, 75.00);

-- ----------------------------
-- Table structure for reviews (EIGHTH - depends on orders, users, services)
-- ----------------------------
DROP TABLE IF EXISTS `reviews`;
CREATE TABLE `reviews`  (
  `review_id` int NOT NULL AUTO_INCREMENT,
  `order_id` int NOT NULL,
  `user_id` int NOT NULL,
  `service_id` int NOT NULL,
  `rating` int NULL DEFAULT NULL,
  `comment` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL,
  `tags` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `seller_reply` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL,
  `seller_reply_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`review_id`) USING BTREE,
  INDEX `order_id`(`order_id` ASC) USING BTREE,
  INDEX `user_id`(`user_id` ASC) USING BTREE,
  INDEX `service_id`(`service_id` ASC) USING BTREE,
  CONSTRAINT `reviews_ibfk_1` FOREIGN KEY (`order_id`) REFERENCES `orders` (`order_id`) ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT `reviews_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`) ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT `reviews_ibfk_3` FOREIGN KEY (`service_id`) REFERENCES `services` (`service_id`) ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT `reviews_chk_1` CHECK ((`rating` >= 1) and (`rating` <= 5))
) ENGINE = InnoDB AUTO_INCREMENT = 2 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci ROW_FORMAT = Dynamic;

-- Records of reviews
INSERT INTO `reviews` VALUES (1, 1, 2, 1, 5, 'Excellent service! Very professional and thorough.', 'Goes the extra mile,Amazing chat', '2026-01-20 23:57:08', NULL, NULL);

-- ----------------------------
-- Table structure for chats (NINTH - depends on orders and users)
-- ----------------------------
DROP TABLE IF EXISTS `chats`;
CREATE TABLE `chats`  (
  `chat_id` int NOT NULL AUTO_INCREMENT,
  `order_id` int NOT NULL,
  `sender_id` int NOT NULL,
  `receiver_id` int NOT NULL,
  `message` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `sent_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`chat_id`) USING BTREE,
  INDEX `order_id`(`order_id` ASC) USING BTREE,
  INDEX `sender_id`(`sender_id` ASC) USING BTREE,
  INDEX `receiver_id`(`receiver_id` ASC) USING BTREE,
  CONSTRAINT `chats_ibfk_1` FOREIGN KEY (`order_id`) REFERENCES `orders` (`order_id`) ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT `chats_ibfk_2` FOREIGN KEY (`sender_id`) REFERENCES `users` (`user_id`) ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT `chats_ibfk_3` FOREIGN KEY (`receiver_id`) REFERENCES `users` (`user_id`) ON DELETE CASCADE ON UPDATE RESTRICT
) ENGINE = InnoDB AUTO_INCREMENT = 4 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci ROW_FORMAT = Dynamic;

-- Records of chats
INSERT INTO `chats` VALUES (1, 1, 2, 3, 'Hi, when can you start the cleaning?', '2026-01-20 23:57:08');
INSERT INTO `chats` VALUES (2, 1, 3, 2, 'I can start tomorrow at 10 AM. Does that work for you?', '2026-01-20 23:57:08');
INSERT INTO `chats` VALUES (3, 1, 2, 3, 'Perfect! See you then.', '2026-01-20 23:57:08');

-- ----------------------------
-- Table structure for fraud_alerts (TENTH - depends on users)
-- ----------------------------
DROP TABLE IF EXISTS `fraud_alerts`;
CREATE TABLE `fraud_alerts`  (
  `alert_id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NULL DEFAULT NULL,
  `alert_type` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL,
  `status` enum('pending','reviewed','resolved') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT 'pending',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`alert_id`) USING BTREE,
  INDEX `user_id`(`user_id` ASC) USING BTREE,
  CONSTRAINT `fraud_alerts_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`) ON DELETE SET NULL ON UPDATE RESTRICT
) ENGINE = InnoDB AUTO_INCREMENT = 4 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci ROW_FORMAT = Dynamic;

-- Records of fraud_alerts
INSERT INTO `fraud_alerts` VALUES (1, 2, 'Multiple failed login attempts', 'User attempted to login 5 times with wrong password', 'pending', '2026-01-20 23:57:08');
INSERT INTO `fraud_alerts` VALUES (2, 2, 'High number of completed quests in a short time', 'User completed 10 orders in 1 hour', 'pending', '2026-01-20 23:57:08');
INSERT INTO `fraud_alerts` VALUES (3, 3, 'Unusual high-value transactions', 'User made a transaction of $5000', 'reviewed', '2026-01-20 23:57:08');

SET FOREIGN_KEY_CHECKS = 1;
