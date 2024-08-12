import slugify from "slugify"
import { Category, Product, SubCategory } from "../../../db/index.js"
import { AppError ,messages, deleteFile} from "../../utils/index.js"


// add category
export const addCategory = async (req, res,next) => {

    // get data from req
    let { name } = req.body
    name =name.toLowerCase()
    // check file
    if(!req.file) {
        return next(new AppError(messages.file.required, 400))
    }

    // check existance
    const categoryExist = await Category.findOne({name})
    if (categoryExist) {
        req.failImage = req.file.path
        return next (new AppError(messages.category.alreadyExist,409))
    }
    //prpare data
    const slug = slugify(name)
    const category = new Category({
        name,
        slug,
        image: {path:req.file.path}
    })
    // add to db
    const createdCategory = await category.save()
    if(!createdCategory) {
        req.failImage = req.file.path
        return next(new AppError(messages.category.failToCreate, 500))
    }
    // send response
    return res.status(201).json({
        message: messages.category.createSuccessfully,
        success:true,
        data:createdCategory})
}


// update category
export const updateCategory =async (req, res,next) => {
    //get data from req
    const {categoryId} = req.params
    const {name} = req.body
    //check existance
    const categoryExist = await Category.findById(categoryId)
    if(!categoryExist) {
        req.failImage = req.file.path
        return next(new AppError(messages.category.notFound, 404))
    }
    //check name existance
    const nameExist = await Category.findOne({name, _id:{$ne:categoryId}})
    if(nameExist) {
        return next(new AppError(messages.category.alreadyExist, 409))
    }
    // prepare data
    if (name) {
        categoryExist.slug = slugify(name)
    }
    // update image
    if(req.file) {
        //delete old image
        deleteFile(categoryExist.image)
        // update new image
        categoryExist.image.path = req.file.path
    }
    // update to db
    const updatedCategory=await categoryExist.save()
    if(!updatedCategory) {
        req.failImage =req.file.path
        return next(new AppError(messages.category.failToUpdate, 500))
    }
    // send response
    return res.status(200).json({
        message: messages.category.updateSuccessfully,
        success:true,
        data:updatedCategory
    })
}

// get category
export const getSpecificCategory = async (req, res,next) => {
    // get data from req
    const {categoryId} = req.params

      //check existance
    const categoryExist = await Category.findById(categoryId).populate([{path:'subcategory'}])
    

     categoryExist ?
     res.status(200).json({
         message: messages.category.getSuccessfully,
         success:true,
         data:categoryExist
     })
     : next(new AppError(messages.category.notFound, 404))
    // axios({
    //     method: 'get',
    //     url: `${req.protocol}://${req.headers.host}/sub-category/${req.params.categoryId}`
    // }).then((response) => {
    //     return res.status(response.status).json(response.data)}).catch((error) => {
    //     return next(new AppError(error.message, 500))
    // })
    //   const categoryExist = await Category.aggregate([
    //       {
    //           $match: {
    //               _id: new Types.ObjectId(categoryId)
    //           }
    //       },
    //       {
    //           $lookup: {
    //               from: "subcategories",
    //               localField: '_id',
    //               foreignField: "category",
    //               as: "subcategories"
    //           }
    //       }
    //   ])
}


// delete category

export const deletCategory = async (req, res, next) => {
    // get data from req
    const { categoryId } = req.params

    // check category existance
    const categoryExist = await Category.findById(categoryId)
    if (!categoryExist) {
        return next(new AppError(messages.category.notFound, 404))
    }

    // prepare ids
    const subcategories = await SubCategory.find({ category: categoryId }).select("image")
    const products = await Product.find({ category: categoryId }).select(["mainImage", "subImages"])
    const subcategoriesIds = subcategories.map(sub => sub._id) // [id1 , id2 , id3]
    const productIds = products.map(product => product._id) // [id1 , id2 , id3]

    // delete subCategories
    await SubCategory.deleteMany({ _id: { $in: subcategoriesIds } });

    // delete products
    await Product.deleteMany({ _id: { $in: productIds } });

    // Delete images of subcategories
    subcategories.forEach(subcategory => {
        deleteFile(subcategory.image.path);
    });

    // Delete images of products
    products.forEach(product => {
        deleteFile(product.mainImage);
        product.subImages.forEach(image => {
            deleteFile(image);
        });
    });

    // delete category
    const deletedCategory = await Category.deleteOne({ _id: categoryId })
    if (!deletedCategory) {
        return next(new AppError(messages.category.failToDelete))
    }
    // delete category image
    deleteFile(categoryExist.image.path)

    return res.status(200).json({ message: messages.category.deleteSuccessfully, success: true })
}
