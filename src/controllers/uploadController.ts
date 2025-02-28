import { Request, Response, NextFunction, json } from "express";
import passport, {
  handleCreateUser,
  handleUpdatePassword,
  handleUpdateName,
  handleCreateFolder,
  handleGetFolders,
  handleGetFolderDetails,
  handleDeleteFolder,
  handleUploadSingleFile,
  handleUploadMultipleFiles,
  handleUpdateFile,
  handleGetUser,
  handleDeleteFile,
  handleGetFile,
} from "../services/userService";
import bcrypt from "bcryptjs";
import path from "path";

interface LoginRequestBody {
  email: string;
  password: string;
}

export const getProfile = async (req: Request, res: Response) => {
  const userId = Number(req.user?.id);
  const folders = await handleGetFolders(userId);
  res.render("profile", { title: `${req.user?.name}`, folders });
};

export const uploadForm = async (req: Request, res: Response) => {
  const userEmail = req.user?.email;

  if (!userEmail) {
    res.status(401).json({ error: "Unauthorized: User not logged in" });
    return;
  }
  const user = await handleGetUser(userEmail);
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const folders = user.Folder;

  res.render("upload-form", {
    title: "Upload Form",
    user: req.user,
    folders: folders,
  });
};

export const uploadSingleFile = async (req: Request, res: Response) => {
  if (!req.file) {
    res.status(400).json({ message: "No file uploaded" });
    return;
  }

  try {
    const filePath = path.join("uploads", req.file.filename);
    const { folderid, userid, filename } = req.body;

    await handleUploadSingleFile(
      filename,
      Number(folderid),
      req.file.size,
      Number(userid),
      path.extname(req.file.originalname),
      filePath
    );

    res.status(201).json({ message: "File uploaded successfully", filePath });
  } catch (err: any) {
    console.error("Upload error:", err);
    res.status(500).json({ message: "Error uploading file" });
  }
};

export const uploadMultipleFiles = async (
  req: Request,
  res: Response
): Promise<void> => {
  if (!req.files || req.files.length === 0) {
    res.status(400).json({ message: "No files uploaded" });
  }

  try {
    const { folderId, userId } = req.body;
    const files = req.files as Express.Multer.File[];

    await handleUploadMultipleFiles(files, Number(folderId), Number(userId));

    res
      .status(201)
      .json({ message: "Files uploaded successfully", files: req.files });
  } catch (err: any) {
    console.error("Upload error:", err);
    res.status(500).json({ message: "Error uploading files" });
  }
};

export const uploadMultipleFields = (req: Request, res: Response) => {
  if (!req.files) return res.status(400).json({ message: "No files uploaded" });
  return res.status(200).json({ files: req.files });
};

export const createUser = async (
  req: Request,
  res: Response
): Promise<void> => {
  const fullname = req.body.firstname + " " + req.body.lastname;
  const email = req.body.email;
  const hashedPassword = await bcrypt.hash(req.body.password, 10);

  try {
    const newUser = await handleCreateUser(fullname, email, hashedPassword);
    res.status(201).json({
      message: `Welcome ${req.body.firstname}`,
      user: newUser,
    });
  } catch (err: any) {
    console.error("Internal server error: ", err);
    res.status(500).json("Internal server error");
  }
};

export const loginUser = (
  req: Request<{}, {}, LoginRequestBody>,
  res: Response,
  next: NextFunction
) => {
  return passport.authenticate(
    "local",
    (err: unknown, user: any, info: any) => {
      if (err) {
        return next(err);
      }

      if (!user) {
        return res.redirect("/log-in");
      }

      req.logIn(user, (err) => {
        if (err) {
          return next(err);
        }

        console.log("User logged in: ", req.user);
        return getProfile(req, res);
      });
    }
  )(req, res, next);
};

export const logoutUser = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  req.logout((error) => {
    if (error) {
      return next(error);
    }
    req.session.destroy(() => {
      res.redirect("/"); //redirect to dashboard after logout
    });
  });
};

export const ensureAuthenticated = (req: any, res: any, next: any) => {
  if (req.isAuthenticated()) {
    return next();
  }
  res.redirect("/log-in");
};

export const updateEmail = async (req: Request, res: Response) => {
  const newEmail = req.body.email;
  try {
    const updatedUser = await handleUpdateName(req.user?.name, newEmail);
    updatedUser
      ? res.status(200).json({
          message: `Updated successful`,
          update: updatedUser.name,
        })
      : res.status(400).json("User update failed or user not found.");
  } catch (err: any) {
    console.error("Internal server error: ", err);
    res.status(500).json({ error: err.message });
  }
};

export const updatePassword = async (req: Request, res: Response) => {
  const email = req.user?.email;
  const newPassword = req.body.newpassword;
  const oldPassword = req.body.oldpassword;
  const oldHashed = req.user?.passwordHash
    ? req.user?.passwordHash.toString()
    : "";

  try {
    if (await bcrypt.compare(oldPassword, oldHashed)) {
      await handleUpdatePassword(email, newPassword);
      return res
        .status(200)
        .json({ message: `Updated ${req.user?.name}'s password.` });
    }
  } catch (err: any) {
    console.error("Internal server error: ", err);
    res.status(500).json({ error: err.message });
  }
};

export const newFolderForm = async (req: Request, res: Response) => {
  const userEmail = req.user?.email || "";
  const user = await handleGetUser(userEmail);
  const folders = user?.Folder;

  res.render("new-folder", { title: "New Folder", folders });
};

export const createFolder = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { foldername, parentid: parentIdRaw } = req.body;
    const userEmail = req.user?.email;

    if (!userEmail) {
      res.status(401).json({ error: "Unauthorized: User not logged in" });
      return;
    }

    const user = await handleGetUser(userEmail);
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    const userId = user.id;
    const folders = user.Folder || [];

    const parentid =
      folders.length === 1 ? folders[0].id : Number(parentIdRaw) || undefined;

    const folder = await handleCreateFolder(foldername, userId, parentid);

    res.status(201).json({ message: "Created folder successfully", folder });
  } catch (err: any) {
    console.error("Internal server error:", err);
    res.status(500).json({ error: err.message });
  }
};

export const getFolders = async (
  req: Request,
  res: Response
): Promise<void> => {
  const userId = Number(req.user?.id);
  try {
    const folders = await handleGetFolders(userId);
    res.render("profile", { title: "Your Folders", folders });
  } catch (err: any) {
    console.error("Internal server error: ", err);
    res.status(500).json({ error: err.message });
  }
};

export const getFolderDetails = async (
  req: Request,
  res: Response
): Promise<void> => {
  const { id } = req.params;

  try {
    const folderDetails = await handleGetFolderDetails(Number(id));
    if (!folderDetails) {
      res.status(404).json({ message: "Folder not found" });
    }

    res.status(200).json({
      folder: folderDetails?.name,
      parentFolder: folderDetails?.parentFolderId,
      files: folderDetails?.file,
    });
  } catch (err: any) {
    console.error("Internal server error: ", err);
    res.status(500).json({ error: err.message });
  }
};

export const deleteFile = async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    await handleDeleteFile(Number(id));
    res.status(200).json({ message: "File deleted successfully!" });
  } catch (err: any) {
    console.error("Internal server error: ", err);
    res.status(500).json({ error: err.message });
  }
};

export const getUpdateForm = async (req: Request, res: Response) => {
  if (req.baseUrl == "/file") {
    const fileId = req.params;
    const file = await handleGetFile(Number(fileId));
    try {
      res.render("update-file", { title: "File Update", file });
    } catch (err: any) {
      console.error("Internal server error: ", err);
      res.status(500).json({ error: err.message });
    }
  } else {
    const folderId = req.params;
    const folder = await handleGetFolderDetails(Number(folderId));
    try {
      res.render("update-folder", { title: "Folder Update", folder });
    } catch (err: any) {
      console.error("Internal server error: ", err);
      res.status(500).json({ error: err.message });
    }
  }
};

export const getFile = async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    const file = await handleGetFile(Number(id));
    res.status(200).json({ name: file?.name, folder: file?.folder });
  } catch (err: any) {
    console.error("Internal server error: ", err);
    res.status(500).json({ error: err.message });
  }
};

export const updateFile = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { filename } = req.body;

  try {
    await handleUpdateFile(Number(id), filename);
  } catch (err: any) {
    console.error("Internal server error: ", err);
    res.status(500).json({ error: err.message });
  }
};

export const deleteFolder = async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    await handleDeleteFolder(Number(id));
    res.status(200).json({ message: "Folder deleted successfully!" });
  } catch (err: any) {
    console.error("Internal server error: ", err);
    res.status(500).json({ error: err.message });
  }
};
